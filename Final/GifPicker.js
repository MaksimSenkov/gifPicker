class GIFPicker {
  #rootElement;
  #resultListElement;
  #cssProperties;

  #GPBody;
  #GPBodyEventsListeners = {};

  #URL;

  #responseDataParseFunction;
  #responseDataCache = new Map();

  #currentData;
  #currentRequestText;
  #currentSearchOffset = 20;

  constructor(options) {
    this.#rootElement = options.root;

    this.#cssProperties = options.css;

    this.#URL = new URL(options.search.url);

    for (let param in options.search.params) {
      this.#URL.searchParams.set(param, options.search.params[param]);
    }

    this.#responseDataParseFunction = options.responseDataParseFunction;

    this.#init();
  }
  appendToRoot(how = "beforeend") {
    this.#rootElement.insertAdjacentElement(how, this.#GPBody);
  }

  #closing = false;
  #destroyed = false;
  open() {
    if (this.#destroyed) {
      throw new Error("GIFPicker was destroyed");
    }
    if (this.#closing) return;

    const cssProperties = this.#cssProperties;
    this.#GPBody.classList.remove(`${cssProperties.main}--${cssProperties.postfixToHide}`);
    setTimeout(() => {
      this.#GPBody.classList.add(`${cssProperties.main}--${cssProperties.postfixToOpen}`);
    }, 0);
  }

  close() {
    if (this.#destroyed) {
      throw new Error("GIFPicker was destroyed");
    }
    this.#closing = true;

    const cssProperties = this.#cssProperties;
    this.#GPBody.classList.remove(`${cssProperties.main}--${cssProperties.postfixToOpen}`);
    setTimeout(() => {
      this.#closing = false;
      this.#GPBody.classList.add(`${cssProperties.main}--${cssProperties.postfixToHide}`);
    }, 1000);
  }

  destroy() {
    this.#GPBody.remove();

    for (let listener in this.#GPBodyEventsListeners) {
      this.#GPBody.removeEventListener(listener, this.#GPBodyEventsListeners[listener]);
    }

    this.#destroyed = true;
  }

  #init() {
    const cssProperties = this.#cssProperties;

    this.#GPBody = document.createElement("div");
    this.#GPBody.classList.add(`${cssProperties.main}`, `${cssProperties.main}--${cssProperties.postfixToHide}`);
    this.#GPBody.insertAdjacentHTML(
      "afterbegin",
      `
        <div class="${cssProperties.main}__${cssProperties.padding}">
             <ul class="${cssProperties.main}__${cssProperties.mainList}">
               <li class="${cssProperties.main}__${cssProperties.placeholder} ${cssProperties.skeleton}"></li>
             </ul>
        </div>
    `
    );

    this.#resultListElement = this.#GPBody.querySelector("ul");
    this.#initListeners();
  }
  #initListeners() {
    this.#GPBodyEventsListeners.click = (e) => {
      const closestButton = e.target.closest("[data-GPButton]");

      if (!closestButton) return;

      const event = new CustomEvent("GPGifChosen", {
        detail: {
          gifId: closestButton.dataset.gifId,
          imageObj: this.#currentData.data[+closestButton.dataset.gifId],
        },
      });
      this.#rootElement.dispatchEvent(event);
      this.close();
    };
    this.#GPBody.addEventListener("click", this.#GPBodyEventsListeners.click);

    this.#GPBodyEventsListeners.GPChange = (event) => {
      if (event.detail.msg !== "continue") {
        this.#clearResultList();
      }

      if (event.detail.msg === "emptySearch") {
        this.#fillResultList([]);
        return;
      }

      const arrayOfGifsPath = this.#responseDataParseFunction(this.#currentData);
      this.#fillResultList(arrayOfGifsPath);
    };
    this.#GPBody.addEventListener("GPChange", this.#GPBodyEventsListeners.GPChange);

    this.#GPBodyEventsListeners.scroll = (event) => {
      const element = this.#resultListElement;

      const height = element.scrollHeight;
      const clientHeight = element.clientHeight;
      const scrolled = element.scrollTop;

      if (height - scrolled - clientHeight < 3) {
        this.#currentSearchOffset += 50;

        if (scrolled < 10) return;

        this.request(100)();
      }
    };
    this.#resultListElement.addEventListener("scroll", this.#GPBodyEventsListeners.scroll);
  }

  #fillResultList(data) {
    let count = 0;
    const cssProperties = this.#cssProperties;

    const cssMain = cssProperties.main;

    if (data.length === 0) {
      this.#resultListElement.insertAdjacentHTML(
        "afterbegin",
        `<li class="${cssProperties.main}__${cssProperties.placeholder} ${cssProperties.skeleton}"></li>`
      );
    }
    for (let item of data) {
      const element = document.createElement("li");
      element.classList.add(`${cssMain}__${cssProperties.itemPlaceholder}`);

      element.insertAdjacentHTML(
        "beforeend",
        `
          <button class="${cssMain}__${cssProperties.button} ${cssProperties.skeleton}" data-GPButton data-gif-id=${count++}>
            <picture>
               <source srcset=${item.webp},
                      type="image/webp">
               <img src=${item.gif} alt="" class="${cssMain}__${cssProperties.item}" />
             </picture>
             
          </button>
      `
      );

      this.#resultListElement.insertAdjacentElement("beforeend", element);
    }
  }

  #clearResultList() {
    this.#resultListElement.innerHTML = "";
  }

  #searchRegexp = /([a-zа-яё0-9]+\s?){0,3}/i;

  request = (ms) => {
    let timeout;

    return (text, ...args) => {
      clearTimeout(timeout);

      timeout = setTimeout(() => {
        let searchString;
        try {
          searchString = text.trim();
        } catch {
          searchString = this.#currentRequestText;
        }

        if (searchString.length === 0) {
          this.#currentRequestText = "";
          this.#notifyAboutEndOfRequest("emptySearch");
          return;
        }

        searchString = searchString.match(this.#searchRegexp)[0];

        if (this.#currentRequestText != searchString) {
          this.#currentSearchOffset = 0;
        }

        this.#currentRequestText = searchString;

        if (this.#responseDataCache.has(searchString) && this.#currentSearchOffset === 0) {
          this.#currentData = this.#responseDataCache.get(searchString);
          this.#notifyAboutEndOfRequest("success");
        } else {
          this.#request(this.#URL, searchString, this.#currentSearchOffset).then((resp) => {
            this.#saveResponseData(searchString, resp);
            this.#currentData = resp;
            if (this.#currentSearchOffset != 0) {
              this.#notifyAboutEndOfRequest("continue");
            } else {
              this.#notifyAboutEndOfRequest("new");
            }
          });
        }
      }, ms);
    };
  };

  async #request(url, searchString, offset) {
    try {
      url.searchParams.set("q", searchString);

      url.searchParams.set("offset", offset);
      let response = await fetch(url);
      let dataJSON = await response.json();
      return dataJSON;
    } catch (error) {
      throw error;
    }
  }
  #notifyAboutEndOfRequest(message) {
    const event = new CustomEvent("GPChange", {
      detail: { msg: message },
    });

    this.#GPBody.dispatchEvent(event);
  }
  #saveResponseData(searchString, data) {
    this.#responseDataCache.set(searchString, data);
  }
}
