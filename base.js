const root = document.querySelector(".chat");

const parseFunction = function (rawData) {
  const data = rawData.data;
  let resultArray = [];

  for (let item of data) {
    const images = item.images;
    resultArray.push({
      webp: images.preview_webp.url,
      gif: images.preview_gif.url,
    });
  }

  return resultArray;
};
const GP = new GIFPicker({
  root: root,
  css: {
    main: "gif-picker",
    postfixToOpen: "open",
    postfixToHide: "hidden",
    padding: "padding",
    mainList: "main",
    itemPlaceholder: "item-placeholder",
    button: "button",
    skeleton: "skeleton",
    item: "item",
    placeholder: "placeholder",
  },
  search: {
    url: "https://api.giphy.com/v1/gifs/search",
    params: {
      api_key: "lt3HGdIo8dRoDKwb1VryNck3CwZMfSII",
      limit: 9,
      rating: "g",
    },
  },

  responseDataParseFunction: parseFunction,
});

GP.appendToRoot();

const write = document.querySelector(".chat-input");
const request = GP.request(1000);

write.addEventListener("input", (event) => {
  const regExp = /(^\/gif\s+){1}/;
  if (regExp.test(write.textContent)) {
    GP.open();
    const search = write.textContent.replace(regExp, "");
    request(search);
  } else {
    GP.close();
  }
});

root.addEventListener("GPGifChosen", (event) => {
  document.getElementById("append").insertAdjacentHTML(
    "beforeend",
    `
  <li class="messeges-group__message">
    <article class="message">
        <div class="message__content">
            
            <picture>
               <source srcset=${event.detail.imageObj.images.fixed_width.webp},
                      type="image/webp">
                      <img src="${event.detail.imageObj.images.fixed_width.url}" alt="" class="message__img" />
             </picture>
        </div>
        <time class="message__time">12:20</time>
    </article>
    </li>
  `
  );
});
