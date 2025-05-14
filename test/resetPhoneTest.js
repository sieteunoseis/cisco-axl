const axlService = require("../index");
const { cleanEnv, str, host, makeValidator } = require("envalid");
var path = require('path');

// If not production load the local env file
if(process.env.NODE_ENV === "development"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'development.env') })
}else if(process.env.NODE_ENV === "test"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'test.env') })
}else if(process.env.NODE_ENV === "staging"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'staging.env') })
}

const versionValid = makeValidator(x => {
  if (/.*\..*[^\\]/.test(x)) return x.toUpperCase()
  else throw new Error('CUCM_VERSION must be in the format of ##.#')
})

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
  CUCM_VERSION: versionValid({ desc: "Cisco CUCM Version." , example: "12.5" })
});

// Set up new AXL service
let service = new axlService(
  env.CUCM_HOSTNAME,
  env.CUCM_USERNAME,
  env.CUCM_PASSWORD,
  env.CUCM_VERSION
);

var operation = "resetPhone";
var tags = {
  "resetPhone": {
    "name": "SEP0038DFB50658"
  }
};

service
  .executeOperation(operation, tags)
  .then((results) => {
    console.log(`${operation} UUID`, results);
  })
  .catch((error) => {
    console.log(error);
  });