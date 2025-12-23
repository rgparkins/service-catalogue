function Mappings() {
    this.pillars = {
        "Customer Channels": [
            "Rewards",
            "MIT",
            "MyCTM - A Team",
            "MyCTM - Cerebro",
            "MyCtM - Gigya",
            "MyCtM - Sign in",
            "MyCtM - HFM",
            "Mobile - Android",
            "Mobile - iOS",
            "AEM"
        ],
        "Data Engineering": [
            "DE - Sales Accreditation",
            "DE - CXM Autocheck",
            "DE - SFMC",
            "DE - Current Generation Platform",
            "DE - SQL",
            "DE - Next Generation Platform",
            "DE - Stabilisation"
        ],
        "Breadth and Money": [
            "Travel",
            "Life",
            "Money and Mortgages",
            "Open Banking",
            "Free Credit Report"
        ],
        "Architecture": [
            "Enterprise Architecture",
            "Solution Architecture",
            "Technology Planning and Resourcing",
            "Application Architecture"
        ],
        "Cloud and infrastructure": [
            "Cloud platform",
            "Service delivery"
        ],
        "Micro-services": [
            "Quoting",
            "Micro machines",
            "Transformers",
            "AllSpark",
            "Meerstrap",
            "Lego"
        ],
        "Motor & Home Services": [
            "Edison",
            "Tesla",
            "Faraday",
            "Home",
            "Home Prefill",
            "Pet",
            "Van",
            "Bike",
            "Car",
            "Partnerships"
        ]
    };

    this.getTeams = () => {
        let teams = [];

        Object.keys(this.pillars).forEach((k) => {
            this.pillars[k].forEach(t => {
                teams.push({ name: t, pillar: k});
            });

        })

        return teams;
    }

    this.getDistinctTeams = () => {
        let teams = [];

        Object.keys(this.pillars).forEach((k) => {
            this.pillars[k].forEach(t => {
                teams.push(t);
            });
        })

        return teams;
    }

    this.getPillars = () => {
        return this.pillars;
    }

    this.isTeamInPillar = (pillar, team) => {
        if (!this.pillars[pillar]) {
            return false;
        }

        return this.pillars[pillar].includes(team);
    }
}


const mappings = new Mappings();

export default mappings;
