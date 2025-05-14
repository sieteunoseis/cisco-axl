const axlService = require("../index");
const { cleanEnv, str, host, makeValidator } = require("envalid");
var path = require('path');
const { jVar } = require("json-variables");

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

var operation = "updateLine";

var lineTemplate = {
  pattern: "%%_extension_%%",
  routePartitionName: "",
  alertingName: "%%_firstName_%% %%_lastName_%%",
  asciiAlertingName: "%%_firstName_%% %%_lastName_%%",
  description: "%%_firstName_%% %%_lastName_%%",
  _data: {
    extension: "\\+13758084010",
    firstName: "Jeremy",
    lastName: "Worden",
  },
};

const lineTags = jVar(lineTemplate);

service
  .executeOperation(operation, lineTags)
  .then((results) => {
    console.log(results);
  })
  .catch((error) => {
    console.log(error);
  });