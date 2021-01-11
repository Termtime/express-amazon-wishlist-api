const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
//env variables for Heroku deployement
const PORT = process.env.PORT || 5000;
const VERSION = process.env.VERSION || "1.0.0";

app.use(cors());
///////////////////////////// API GET Endpoints
app.get("/", (_req, res) =>
  res.send({ title: "Amazon Wishlist API", version: VERSION })
);
//GET /search: Search a query in amazon's search
app.get("/search", async (req, res) => {
  const { q } = req.query;
  // Return error status if the q var is empty
  if (!q || q.length === 0) {
    return res.status(422).send({
      message: "Missing 'q' value for the search.",
    });
  }

  // Change spaces for the "+" symbol
  const formattedQuery = q.replace(" ", "+");
  return res.send({ data: await searchAmazon(formattedQuery) });
});
//GET /wishlist: Get the list of items that pertain to a wishlist ID
app.get("/wishlist", async (req, res) => {
  const { q } = req.query;
  if (!q || q.length === 0) {
    return res.status(422).send({
      message:
        "Missing or invalid 'q' value, this is the wishlist ID from the amazon's wishlist URL.",
    });
  }

  return res.send({ data: await searchWishlistID(q) });
});

const searchAmazon = async (query) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--incognito"],
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (
      req.resourceType() == "stylesheet" ||
      req.resourceType() == "font" ||
      req.resourceType() == "image"
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`https://www.amazon.com/s?k=${query}`);

  const getData = await page.evaluate(() => {
    console.log("getData");
    const data = [];
    const items = document.querySelector(
      ".s-main-slot.s-result-list.s-search-results.sg-row"
    );

    for (let i = 0; i < items.children.length; i++) {
      const name = items.children[i].querySelector("h2 > a span");
      const url = items.children[i].querySelector("h2 > a");
      const image = items.children[i].querySelector("img");
      const price = items.children[i].innerHTML.match(
        /\$([0-9]+|[0-9]+,[0-9]+).([0-9]+)/g
      );
      if (name || url || image || price) {
        data.push({
          name: (name && name.innerText) || "Unknown Name",
          url: (url && url.getAttribute("href")) || "Unknown URL",
          image: (image && image.getAttribute("src")) || "Unknown Image URL",
          price:
            (price && price.length > 0 && price[0].replace(/[\$\,]/g, "")) ||
            "Out of Stock for this seller.",
        });
      }
    }

    return data;
  });

  // Close the page and the browser
  await page.close();
  await browser.close();

  return getData;
};

//Function that returns the JSON data of all the items that manages to load from the wishlist
const searchWishlistID = async (wishlistID) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--incognito"],
  });
  const context = browser.createIncognitoBrowserContext();
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (
      req.resourceType() == "stylesheet" ||
      req.resourceType() == "font" ||
      req.resourceType() == "image"
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });
  await page.setViewport({ width: 1920, height: 1080 });

  const sort = "sort=date-added"; //priority, universal-title, universal-price, universal-price-desc, last-updated
  const reveal = "reveal=all"; //unpurchased, purchased
  const url = `https://www.amazon.com/hz/wishlist/ls/${wishlistID}?${reveal}&${sort}&layout=standard&viewType=list`;
  console.log(url);
  await page.goto(url);
  page.on("console", (message) =>
    console.log(
      `${message.type().substr(0, 3).toUpperCase()} - ${message.text()}`
    )
  );
  const getData = await page
    .evaluate(() => {
      return new Promise((resolve, reject) => {
        console.log("evaluating webpage");
        let scrollTop = -1;
        let data = [];
        const getItems = () => {
          console.log("Getting items");
          const items = document.querySelector("#g-items");
          if (!items) {
            console.log("items do not exist");
          }
          for (let i = 0; i < items.children.length; i++) {
            const name = items.children[i].querySelector(
              " div.a-fixed-left-grid.a-spacing-none > div > div.a-text-left.a-fixed-left-grid-col.g-item-sortable-padding.a-col-right > div.a-fixed-right-grid > div > div.a-fixed-right-grid-col.g-item-details.a-col-left > div > div.a-column.a-span12.g-span12when-narrow.g-span7when-wide > div:nth-child(1) > h3 > a"
            );
            const baseUrl = "https://www.amazon.com";
            const url = items.children[i].querySelector(
              " div.a-fixed-left-grid.a-spacing-none > div > div.a-text-left.a-fixed-left-grid-col.g-item-sortable-padding.a-col-right > div.a-fixed-right-grid > div > div.a-fixed-right-grid-col.g-item-details.a-col-left > div > div.a-column.a-span12.g-span12when-narrow.g-span7when-wide > div:nth-child(1) > h3 > a"
            );
            const image = items.children[i].querySelector("a > img");
            const price = items.children[i].innerHTML.match(
              /\$([0-9]+|[0-9]+,[0-9]+).([0-9]+)/g
            );

            if (name || url || image || price) {
              data.push({
                name: (name && name.innerText) || "Unknown Name",
                url:
                  baseUrl + (url && url.getAttribute("href")) || "Unknown URL",
                image:
                  (image && image.getAttribute("src")) || "Unknown Image URL",
                price:
                  (price &&
                    price.length > 0 &&
                    price[0].replace(/[\$\,]/g, "")) ||
                  "Out of Stock for this seller.",
              });
            }
          }
          //remove dud entry at the end
          if (data.length > 0) data.pop();
        };
        console.log("scrolling");
        const interval = setInterval(() => {
          window.scrollBy(0, window.innerHeight);
          if (document.documentElement.scrollTop !== scrollTop) {
            scrollTop = document.documentElement.scrollTop;
          } else {
            clearInterval(interval);
            console.log("finished scrolling");
            getItems();
            console.log("sending data");
            resolve(data);
          }
        }, 400);
      });
    })
    .catch((error) => {
      console.error("ERROR OCURRED", error);
    });
  // Close page and browser
  await page.close();
  await browser.close();
  console.log("getData: ", getData);
  return getData;
};

//start server
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
