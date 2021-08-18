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

async function getProfilesAndCarriers() {
    let sql = (`SELECT name, profile_url, job_title, email, tenure, airtable_id
                FROM profiles
                         JOIN carriers ON carrier_id = carriers.id`);
    return await new Promise((resolve, reject) => {
        con.query(sql, async function (err, result) {
            if (err) {
                throw err;
            }
            if (result.length >= 1) {
                console.log(result)
                resolve(result)
            } else {
                resolve(false);
            }
        });
    });
}

async function uploadData() {
    let profiles = await getProfilesAndCarriers();
    if (profiles === false) {
        console.log('Fill the table of Profiles and Carriers first!');
        process.exit();
    }
    for (let profile of profiles) {
        let carrierIdArray = [];
        carrierIdArray.push(profile.airtable_id)
        const profileData = {
            'Name': profile.name,
            'Profile Url': profile.profile_url,
            'Job Title': profile.job_title,
            'Email': profile.email,
            'Working Tenure': profile.tenure,
            'Carriers': carrierIdArray
        };
        await base(inputbase).create(profileData, async function(err, record) {
            if (err) {
                console.error(err);
            }
            console.log(await record.getId());
        });
    }
}
const inputbase = 'Carriers Workers';

uploadData()