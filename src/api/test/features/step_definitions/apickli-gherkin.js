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