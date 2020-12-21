const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
//env variables for Heroku deployement
const PORT = process.env.PORT || 5000;
const VERSION = process.env.VERSION || "1.0.0";

app.use(cors());

const SearchAmazon = async (query) => {
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
            "0.00",
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
//Function that returns the JSON data of all the first 10 items in the wishlist
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
      `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
    )
  );
  const getData = await page
    .evaluate(() => {
      console.log("evaluating");
      var scrollTop = -1;
      const data = [];
      const getItems = () => {
        const items = document.querySelector("#g-items");
        console.log(items);
        if (!items) {
          console.log("items do not exists");
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
              url: baseUrl + (url && url.getAttribute("href")) || "Unknown URL",
              image:
                (image && image.getAttribute("src")) || "Unknown Image URL",
              price:
                (price &&
                  price.length > 0 &&
                  price[0].replace(/[\$\,]/g, "")) ||
                "0.00",
            });
          }
        }
      };

      const interval = setInterval(() => {
        console.log("scrolling");
        window.scrollBy(0, 100);
        if (document.documentElement.scrollTop !== scrollTop) {
          scrollTop = document.documentElement.scrollTop;
          return;
        }

        clearInterval(interval);
        resolve();
        console.log("finished scrolling");
        getItems();
      }, 400);

      return data;
    })
    .catch((error) => {
      console.log("ERROR OCURRED");
      console.log(error);
    });

  // Close page and browser
  await page.close();
  await browser.close();

  return getData;
};

// API GET Endpoints
app.get("/", (_req, res) => res.send({ version: VERSION }));

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
  return res.send({ data: await SearchAmazon(formattedQuery) });
});

app.get("/wishlist", async (req, res) => {
  const { q } = req.query;
  if (!q || q.length === 0) {
    return res.status(422).send({
      message: "Missing or invalid 'q' value for wishlist search.",
    });
  }

  return res.send({ data: await searchWishlistID(q) });
});

//start server
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
