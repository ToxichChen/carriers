const axios = require("axios")
const mysql = require('mysql');
const fetch = require('node-fetch');

let con = mysql.createConnection({
    host: "localhost",
    user: "dmitry",
    password: "aqswdefr1",
    database: "carriers"
});

const searchScrapperId = '2575307990645423';
const rocketSearchApiKey = '8cd41kb002500ac227ce845e7e889ac9d40265';
const phantomBusterApiKey = '1JoB23frVJEWFrHFij1W8OIC4JeDGKSgNH3Z0vxei9Q';
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
        emails = result.emails
        if (emails.length !== 0 && typeof(emails[0].email) != "undefined") {
            return emails[0].email;
        } else {
            return '';
        }
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
    for (const element of array) {
        let job = (typeof(element.job) !== "undefined") ? element.job.toLowerCase() : '';
        console.log(job)
        if ((job.includes("head") || job.includes("chief") || job.includes("director")) && job.includes("security")/* && job.includes(company)*/) {
            let email = await searchForEmail(element.url);
            // Saving to database
            let sql = (`INSERT INTO profiles (country, carries, profile_url, Chief_Security_Officer, CSO_Title, CSO_email, carrier_id) VALUES ( '${element.location}', '${company}', '${element.profileUrl}', '${element.name}', '${element.job}', '${email}', ${parsedCarrierId}) `);
            console.log(sql);
            con.query(sql, function (err, result, fields) {
                if (err) throw err;
                console.log("1 record inserted");
                //return true;
            });
        }
    }
}

async function updateCarriers(carrierId) {
    let sql = (`UPDATE carriers SET is_parsed = 1 WHERE id = ${carrierId}`);
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

async function fetchData (containerId) {
    let result = await getResults(containerId);
    if (result === false) {
        console.log('Error occured')
    } else if (result.error) {
        console.log(result)
    } else {
        await saveResults(result)
        await updateCarriers(parsedCarrierId);
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
    let sql = (`SELECT * FROM accounts WHERE active = 1`);
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

async function getCarriers() {
    let sql = (`SELECT * FROM carriers WHERE is_parsed = 0 limit 9`);
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
    let carriers = await getCarriers();
    let accounts = await getAccounts();
    let accountsIndex = 0;
    for (let carrier of carriers) {
        console.log(carrier.Brand_Name)
        console.log(accounts[accountsIndex].session_token)
        parsedCarrierId = carrier.id;
        company = carrier.Brand_Name;
        await fetchData (await runSearchParser(carrier.Brand_Name + ' security', accounts[accountsIndex].session_token));
        if (accountsIndex === 2) {
            accountsIndex -= 2;
        } else {
            accountsIndex++;
        }
    }
}


// ---------Start---------
// Reading values from console
let searchArguments = [];
let company = '';
let parsedCarrierId = '';
// process.argv.forEach(function (val, index, array) {
//     if (index > 1) {
//         searchArguments.push(val);
//     }
// });
// company = searchArguments[0];
// searchArguments.forEach(element => query = query + ' ' + element)
// console.log(query)
//Running search process on phantombuster
runParser()