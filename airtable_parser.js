let Airtable = require('airtable');
let base = new Airtable({apiKey: 'keytvFhqneWKMyPnX'}).base('app60wmuP5QM2G430');
const mysql = require('mysql');
const credentials = require('./credentials.js');

let con = mysql.createConnection({
    host: credentials.dbHost,
    user: credentials.dbUser,
    password: credentials.dbPassword,
    database: credentials.database
});

function getCarriers() {
    let sql = (`SELECT * FROM carriers`);
    con.query(sql, async function (err, result) {
        if (err) {
            throw err;
        }
        if (result.length >= 1) {
            return result;
        } else {
            return false;
        }
    });
}

base('Carriers').select({
    // Selecting records in Grid view:
    maxRecords: 1000,
    view: "Grid view"
}).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.
    let carriersArray = getCarriers();
    // If running for the first time - fill the database
    if (carriersArray === false) {
        records.forEach(function (record) {
            console.log('Retrieved', record.get('Country'));
            let sql = (`INSERT INTO carriers (country, Carriers, CSO_Title, CSO_Email, URL, Brand_Name) VALUES ( '${record.get('Country')}', '${record.get('Carriers')}', '${record.get('CSO Title')}', '${record.get('CSO Email')}', '${record.get('URL')}', '${record.get('Brand Name')}' ) `);
            // console.log(sql);
            con.query(sql, function (err, result, fields) {
                if (err) throw err;
                console.log("1 record inserted");
                //return true;
            });
        });
    }
    // If database is already filled - add Airtable's id to each row
    records.forEach(function (record) {
        console.log('Retrieved', record.get('Brand Name'));
        let query = `UPDATE carriers SET airtable_id = '${record.getId()}' WHERE Brand_Name = "${record.get('Brand Name')}"`
        // console.log(sql);
        con.query(query, function (err, result, fields) {
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
    if (err) {
        console.error(err);
        return;
    }
});