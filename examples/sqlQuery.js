const axlService = require("../index");

// Set up new AXL service
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0"
);

(async () => {
  var method = "executeSQLQuery";
  var params = await service.getMethodParams(method);
  console.log(params);
  var sqlQuery = `select d.name, d.description, n.dnorpattern as DN from device as d,
  numplan as n, devicenumplanmap as dnpm where dnpm.fkdevice = d.pkid and
  dnpm.fknumplan = n.pkid and d.tkclass = 1`;
  params.sql = sqlQuery;
  console.log(params);

  await service
    .executeMethod(method, params)
    .then((results) => {
      console.log(results);
    })
    .catch((error) => {
      console.log(error);
    });
})();