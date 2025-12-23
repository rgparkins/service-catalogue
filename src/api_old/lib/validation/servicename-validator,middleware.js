import _ from 'underscore';

class ServicenameValidatorMiddleware {
    constructor() {
        this.domains = [
        'broadband',
        'content',
        'market',
        'meerkat',
        'customer-account',
        'data',
        'data-solutions',
        'bi',
        'eng',
        'data-governance',
        'errf',
        'energy',
        'external',
        'home',
        'life',
        'mobile',
        'money',
        'cash-isas',
        'credit-cards',
        'current-accounts',
        'loans',
        'mortgages',
        'savings-accounts',
        'credit-report',
        'motor',
        'bike',
        'car',
        'van',
        'partnerships',
        'pet',
        'platform',
        'cicd',
        'engineering',
        'infrastructure',
        'meerstrap',
        'observability',
        'paas',
        'pricing',
        'panel',
        'quoting',
        'product',
        'rewards',
        'travel',
        "security",
        "customer",
        "identity",
        "consent",
        "account"
    ]

        }

    validateServiceName(name) {
        let self = this;

        var matched = _.find(self.domains, function(domain){
            return name.indexOf(`${domain}.`) === 0;
        });

        return !!matched;
    }
}

export default ServicenameValidatorMiddleware;
