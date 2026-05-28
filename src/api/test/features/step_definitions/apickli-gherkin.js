const { Given } = require('cucumber');
const apickli = require('apickli/apickli-gherkin');
let fs = require('fs');
let path = require('path');

Given(/^I update payload from file (.*) to body$/, function(file, callback) {
    let self = this.apickli;

    fs.readFile(path.join(self.fixturesDirectory, file), 'utf8', function(err, data) {
        if (err) {
            callback(err);
        } else {
            self.setRequestBody(data);

            callback();
        }
    });
});

Given(/^I set bearer token to (.*)$/, function(token, callback) {
    const resolved = this.apickli.replaceVariables(token);
    delete this.apickli.headers['Authorization'];
    delete this.apickli.headers['authorization'];
    this.apickli.headers['Authorization'] = `Bearer ${resolved}`;
    callback();
});

Given(/^I set (.*) header exactly to (.*)$/, function(headerName, headerValue, callback) {
    const resolvedName = this.apickli.replaceVariables(headerName);
    const resolvedValue = this.apickli.replaceVariables(headerValue);
    delete this.apickli.headers[resolvedName];
    delete this.apickli.headers[resolvedName.toLowerCase()];
    this.apickli.headers[resolvedName] = resolvedValue;
    callback();
});
