function Mappings() {
    this.pillars = {
        "Account": [
            "Newton",
            "Einstein",
            "Curie",
            "Darwin",
            "Fermi"
        ],  
        "Data": [
            "Data Science",
            "Data Insights",
            "Data Platforms",
            "Data Governance"
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
