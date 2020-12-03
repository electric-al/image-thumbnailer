
const sapp = require('./index').app

const port = process.env.PORT || 8080;
sapp.listen(port, () => {
  console.log('App listening on port', port);
});