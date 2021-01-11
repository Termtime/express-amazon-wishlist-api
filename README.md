Express JSON API that returns the items in an Amazon wishlist page

## Endpoints

### /Search
Will return the items of the sent search query
parameters:

q ---> Search Query (non formatted, example: 'Radeon rx 580')

### /Wishlist
Will return the items of the sent wishlist ID

q ---> Amazon wishlist ID (from the wishlist URL)

Both endpoints return this JSON data structure:

![response data structure](https://i.imgur.com/KmPwbee.png)

