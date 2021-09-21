const axios = require("axios")
const mysql = require('mysql');
const fetch = require('node-fetch');
const credentials = require('./credentials.js')

let con = mysql.createConnection({
    host: credentials.dbHost,
    user: credentials.dbUser,
    password: credentials.dbPassword,
    database: credentials.database
});

const profileScrapperId = credentials.profileScrapper;
const phantomBusterApiKey = credentials.phantomBusterApiKey;
// Credentials for phantombuster
const initOptions = {
    headers: {
        "x-phantombuster-key": phantomBusterApiKey,
        "Content-Type": "application/json",
    },
}

// Check phantombuster search process
async function checkStatus(agentId) {
    let url = 'https://api.phantombuster.com/api/v2/agents/fetch-output?id=' + agentId;
    let result = '';
    let options = {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-Phantombuster-Key': phantomBusterApiKey
        }
    };

    let response = await fetch(url, options)
    if (response.ok) {
        result = await response.json();
        return result.status;
    }
}

async function updateProfile(dateRange, email, is_verified) {
    let sql = (`UPDATE profiles SET is_scraped = 1, tenure = '${dateRange}', email = '${email}', is_verified = ${is_verified} WHERE id = ${parsedProfileId}`);
    return await new Promise((resolve) => {
        con.query(sql, async function (err, result) {
            if (err) {
                throw err;
            }
            resolve(result);
        });
    });
}

async function compareStrings(firstString, secondString) {
    let firstArray = Array.from(firstString);
    let secondArray = Array.from(secondString);
    let count = 0;
    for (let i = 0; i < firstArray.length; i++) {
        if (firstArray[i] === secondArray[i]) {
            count++;
        }
    }
    if (count === 0) {
        return false;
    }
    return (count / firstArray.length) >= 0.7;
}


// Get and save results of searches
async function getResults(containerId) {
    let url = 'https://api.phantombuster.com/api/v1/agent/' + profileScrapperId + '/output';
    console.log('Container ID: ' + containerId)
    let options = {
        method: 'GET',
        qs: {containerId: containerId, withoutResultObject: 'false'},
        headers: {
            Accept: 'application/json',
            'X-Phantombuster-Key': phantomBusterApiKey
        }
    };
    let status = '';
    let result = '';
    // Receiving status, if finished than go on.
    do {
        status = await checkStatus(profileScrapperId);
        console.log(status)
    } while (status !== 'finished')
    let response = await fetch(url, options)
    if (response.ok) {
        result = await response.json();
        console.log(result)
        if (result.data.resultObject && result.data.resultObject.includes("No activity")) {
            return {
                notice: "No activity"
            }
        } else if (result.data.output.split('Error:')[1]) {
            return {
                error: result.data.output.split('Error:')[1]
            }
        } else if (result.data.output.includes("Can't connect to LinkedIn with this session cookie.")) {
            return {
                error: "Can't connect to LinkedIn with this session cookie."
            }
        } else if (result.data.resultObject) {
            return await JSON.parse(result.data.resultObject)
        } else {
            return false;
        }
    }
}

async function fetchData(containerId, profile) {
    let result = await getResults(containerId);
    if (result === false) {
        console.log('Error occured')
    } else if (result.error) {
        console.log(result)
    } else {
        let email = '';
        if (profileObject.email === '' && typeof (result[0].dropcontact[0]) !== 'undefined') {
            email = result[0].dropcontact[0].email;
        }
        if (await compareStrings(result[0].jobs[0].companyName.toLowerCase().trim(), profileObject.carrier.toLowerCase()) && result[0].jobs[0].jobTitle.toLowerCase().includes(profileObject.work_sphere.toLowerCase())) {
            is_verified = 1;
        }
        if (typeof (result[0].jobs[0]) !== 'undefined' && typeof (result[0].jobs[0].dateRange) !== 'undefined') {
            console.log(result[0].jobs[0].dateRange)
            console.log(result[0].jobs[0].jobTitle)
            await updateProfile(result[0].jobs[0].dateRange, email, is_verified);
        }
    }
}

async function runProfileScrapper(link, sessionCookie) {
    return await new Promise((resolve) => {
        axios
            .post(
                "https://api.phantombuster.com/api/v2/agents/launch",
                {
                    "id": credentials.profileScrapper,
                    "argument": {
                        "numberOfAddsPerLaunch": 1,
                        "saveImg": false,
                        "takeScreenshot": false,
                        "takePartialScreenshot": false,
                        "sessionCookie": sessionCookie,
                        "spreadsheetUrl": link,
                        "emailChooser": "phantombuster"
                    }
                },
                initOptions,
            )
            .then((res) => resolve(res.data.containerId))
            .catch((error) => console.error("Something went wrong :(", error))
    });
}

async function getAccounts() {
    let sql = (`SELECT *
                FROM accounts
                WHERE active = 1`);
    return await new Promise((resolve) => {
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

async function getProfiles() {
    let sql = (`SELECT *
                FROM profiles
                WHERE is_scraped = 0
                  and profile_url != ''
                  and is_scraped = 0
                limit 3`);
    return await new Promise((resolve) => {
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

async function runParser() {
    let profiles = await getProfiles();
    let accounts = await getAccounts();
    let accountsIndex = 0;
    console.log(accounts);
    for (let profile of profiles) {
        is_verified = 0;
        console.log(profile.name);
        console.log(accounts[accountsIndex].name + " " + accounts[accountsIndex].last_name);
        parsedProfileId = profile.id;
        profileObject = profile;
        await fetchData(await runProfileScrapper(profile.profile_url, accounts[accountsIndex].session_token));
        if (accountsIndex === 2) {
            accountsIndex -= 2;
        } else {
            accountsIndex++;
        }
    }
    con.end();
}

let profileObject;
let parsedProfileId = '';
let is_verified;
runParser()