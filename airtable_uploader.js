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

async function sleep() {
    let time = 20000;
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

async function getProfilesAndCarriers() {
    let sql = (`SELECT name, profile_url, job_title, email, tenure, airtable_id, work_sphere
                FROM profiles
                         JOIN carriers ON carrier_id = carriers.id`);
    return await new Promise((resolve, reject) => {
        con.query(sql, async function (err, result) {
            if (err) {
                throw err;
            }
            if (result.length >= 1) {
                resolve(result)
            } else {
                resolve(false);
            }
        });
    });
}

async function chunkArray(myArray, chunk_size){
    let index = 0;
    let arrayLength = myArray.length;
    let tempArray = [];

    for (index = 0; index < arrayLength; index += chunk_size) {
        myChunk = await myArray.slice(index, index+chunk_size);
        // Do something if you want with the group
        await tempArray.push(myChunk);
    }

    return tempArray;
}

async function uploadData() {
    let errorsCount = 0;
    let profiles = await getProfilesAndCarriers();
    if (profiles === false) {
        console.log('Fill the table of Profiles and Carriers first!');
        con.end();
        process.exit();
    }
    let result = await chunkArray(profiles, 200);
    for (let profilesArray of result) {
        for (let profile of profilesArray) {
            let carrierIdArray = [];
            carrierIdArray.push(profile.airtable_id)
            const profileData = {
                'Name': profile.name,
                'Profile Url': profile.profile_url,
                'Job Title': profile.job_title,
                'Email': profile.email,
                'Working Tenure': profile.tenure,
                'Carriers': carrierIdArray,
                'Work Sphere': profile.work_sphere
            };
            await base(inputbase).create(profileData, async function(err, record) {
                if (err) {
                    console.error(err);
                    errorsCount++;
                    console.log("Failed uploads = " + errorsCount)
                }
                try {
                    console.log(await record.getId());
                } catch (e) {
                    console.log(e)
                }
            });
        }
        console.log("___________________ TIER PASSED ___________________")
        console.log("Failed uploads = " + errorsCount)
        await sleep();
    }
    await con.end();
}
const inputbase = 'Carriers Workers';

uploadData()