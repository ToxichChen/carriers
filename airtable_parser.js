var Airtable = require('airtable');
var base = new Airtable({apiKey: 'keytvFhqneWKMyPnX'}).base('app60wmuP5QM2G430');
const mysql = require('mysql');

let con = mysql.createConnection({
    host: "mysql",
    user: "root",
    password: "root",
    database: "carriers"
});

base('Carriers').select({
    // Selecting the first 3 records in Grid view:
    maxRecords: 1000,
    view: "Grid view"
}).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
        console.log('Retrieved', record.get('Country'));
        let sql = (`INSERT INTO carriers (country, Carriers, CSO_Title, CSO_Email, URL, Brand_Name) VALUES ( '${record.get('Country')}', '${record.get('Carriers')}', '${record.get('CSO Title')}', '${record.get('CSO Email')}', '${record.get('URL')}', '${record.get('Brand Name')}' ) `);
        // console.log(sql);
        con.query(sql, function (err, result, fields) {
            if (err) throw err;
            console.log("1 record inserted");
            //return true;
        });
    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    fetchNextPage();

}, function done(err) {
    if (err) { console.error(err); return; }
});