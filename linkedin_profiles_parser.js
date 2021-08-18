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

let country_list = credentials.country_list

const searchScrapperId = credentials.searchScrapperId;
const rocketSearchApiKey = credentials.rocketSearchApiKey;
const phantomBusterApiKey = credentials.phantomBusterApiKey;
// Credentials for phantombuster
const initOptions = {
    headers: {
        "x-phantombuster-key": phantomBusterApiKey,
        "Content-Type": "application/json",
    },
}

// Calling to rocketreach.co for email by LinkedIn url
async function searchForEmail(linkedinUrl) {
    let url = 'https://api.rocketreach.co/v2/api/lookupProfile?li_url=' + linkedinUrl;
    let emails = [];
    let result = '';
    let options = {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Api-Key': rocketSearchApiKey
        }
    };

    let response = await fetch(url, options)
    if (response.ok) {
        result = await response.json();
        console.log(result.emails);
        emails = result.emails;
        if (emails.length !== 0 && typeof (emails[0].email) != "undefined") {
            return emails[0].email;
        } else {
            return '';
        }
    } else {
        return '';
    }
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

async function saveResults(array) {
    let count = 0;
    let undefined = 0;
    for (const element of array) {
        let job = (typeof (element.job) !== "undefined") ? element.job.toLowerCase() : '';
        console.log(job)
        if (/*(job.includes("head") || job.includes("chief") || job.includes("director")) && */ job.includes(workSphere)/* && job.includes(company)*/) {
            let companyName = company;
            for (let country of country_list) {
                if (company.includes(country)) {
                    companyName = company.replace(country, '')
                    companyName = companyName.trim();
                }
            }
            console.log(companyName)
            if (job.includes(companyName.toLowerCase())) {
                console.log(element.name)
                let name = '';
                if (typeof (element.name) === "undefined") {
                    undefined++;
                } else {
                    name = element.name;
                }
                count++;
                let email = await searchForEmail(element.url);
                // Saving to database
                let sql = (`INSERT INTO profiles (country, carrier, profile_url, name, job_title, email, carrier_id, work_sphere) VALUES ( '${element.location}', '${company}', '${element.profileUrl}', '${name}', '${element.job}', '${email}', ${parsedCarrierId}, '${workSphere}') `);
                console.log(sql);
                let result = con.query(sql, async function (err, result, fields) {
                    if (err) {
//                        await updateCarriers(parsedCarrierId, 2);
                        return false;
                    }
                    console.log("1 record inserted");
                    return true;
                });
                if (!result) {
                    return 2;
                }
            }
        }
    }
    if (count === 0) {
        return 3;
    } else if (undefined !== 0) {
        return 2;
    }
    return 1;
}

async function updateCarriers(carrierId, state) {
    let sql = '';
    if (workSphere === 'security') {
        sql = (`UPDATE carriers SET is_parsed_security = ${state} WHERE id = ${carrierId}`);
    } else if (workSphere === 'identity') {
        sql = (`UPDATE carriers SET is_parsed_identity = ${state} WHERE id = ${carrierId}`);
    } else if (workSphere === 'authentication') {
        sql = (`UPDATE carriers SET is_parsed_auth = ${state} WHERE id = ${carrierId}`);
    }
    return await new Promise((resolve, reject) => {
        con.query(sql, async function (err, result) {
            if (err) {
                throw err;
            }
            resolve(result);
        });
    });
}

// Get and save results of searches
async function getResults(containerId) {
    let url = 'https://api.phantombuster.com/api/v1/agent/' + searchScrapperId + '/output';
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
        status = await checkStatus(searchScrapperId);
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

async function fetchData(containerId) {
    let result = await getResults(containerId);
    if (result === false) {
        console.log('Error occured')
    } else if (result.error) {
        console.log(result)
    } else {
        await updateCarriers(parsedCarrierId, await saveResults(result));
    }
}

async function runSearchParser(query, sessionCookie) {
    return await new Promise((resolve, reject) => {
        axios.post(
            "https://api.phantombuster.com/api/v2/agents/launch",
            {
                "id": searchScrapperId,
                "argument":
                    {
                        "firstCircle": true,
                        "secondCircle": true,
                        "thirdCircle": true,
                        "category": "People",
                        "numberOfLinesPerLaunch": 10,
                        "sessionCookie": sessionCookie,
                        "search": query,
                        "numberOfResultsPerLaunch": 30,
                        "numberOfResultsPerSearch": 30,
                        "removeDuplicateProfiles": false,
                    },
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

async function getCarriers(count) {
    let sql = '';
    if (workSphere === 'security') {
        sql = (`SELECT *
                FROM carriers
                WHERE is_parsed_security = 0
                limit ${count}`);
    } else if (workSphere === 'identity') {
        sql = (`SELECT *
                FROM carriers
                WHERE is_parsed_identity = 0
                limit ${count}`);
    } else if (workSphere === 'authentication') {
        sql = (`SELECT *
                FROM carriers
                WHERE is_parsed_auth = 0
                limit ${count}`);
    } else {
        console.log("PLEASE ENTER CORRECT WORK SPHERE (security, identity, authentication)")
        process.exit()
    }
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

async function runParser() {
    let accounts = await getAccounts();
    let carriers = await getCarriers(accounts.length * 3);
    console.log(accounts)
    let accountsIndex = 0;
    for (let carrier of carriers) {
        console.log(carrier.Brand_Name)
        console.log(accounts[accountsIndex].name + " " + accounts[accountsIndex].last_name)
        parsedCarrierId = carrier.id;
        company = carrier.Brand_Name;
        if (company.includes(' - ')) {
            company = company.replace(' - ', ' ');
        }
        console.log(company)
        await fetchData(await runSearchParser(company + ' ' + workSphere, accounts[accountsIndex].session_token));
        if (accountsIndex + 1  === accounts.length) {
            accountsIndex -= accounts.length -1;
        } else {
            accountsIndex++;
        }
    }
    con.end();
}


// ---------Start---------
// Reading values from console
let workSphere = credentials.workSphere;
let company = '';
let parsedCarrierId = '';
runParser()