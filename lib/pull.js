class Pull {
    constructor(payload) {
        this.labels = payload.pull_request.labels.map(x => x.name);
        this.owner = payload.repository.owner.login;
        this.pull_number = payload.pull_request.number;
        this.reviews = [];
        this.branch_name = payload.pull_request.head.ref;
        this.ref = `${payload.pull_request.head.sha}`;
        this.repo = payload.repository.name;
        this.requested_reviewers = payload.pull_request.requested_reviewers;
        this.checks = {};
        this.headRepoId = payload.pull_request.head.repo.id;
        this.baseRepoId = payload.pull_request.base.repo.id;
    }

    /**
     * Determines if a review is complete
     * @param {boolean} required is a review required
     */
    isReviewComplete(required) {
        if (!required) {
            return true;
        }

        if (this.requested_reviewers.length > 0) {
            console.log('merge failed: requested_reviewers must be equal to zero');
            return false;
        }

        if (Object.keys(this.reviews).length == 0) {
            console.log('merge failed: reviews must be greater than zero');
            return false;
        }

        let approved = false;
        for (let [key, value] of Object.entries(this.reviews)) {
            if (value.state === "APPROVED") {
                approved = true;
                continue
            }

            if (value.state === "COMMENTED") {
                continue;
            }

            console.log('merge failed: not all reviews in state of APPROVED');
            return false;
        }

        return approved;
    }

    /**
     * Updates Pull with review data
     * @param {Object} reviews review data from pull request
     */
    compileReviews(reviews) {
        const data = reviews.data;
        let compiled = {};

        if (data && Object.keys(data).length > 0) {
            data.forEach(element => {
                const user = element.user.login;
                const date = element.submitted_at;
                const state = element.state;

                if (typeof (compiled[user]) !== 'undefined') {
                    if (date > compiled[user].date) {
                        compiled[user] = {
                            date: date,
                            state: state
                        }
                    }
                } else {
                    compiled[user] = {
                        date: date,
                        state: state
                    }
                }
            });
        }

        this.reviews = compiled;
    }

    /**
     * Determines if checks are complete
     * @param {boolean} checks_enabled is the checks_enabled config enabled
     */
    isChecksComplete(checks_enabled) {
        if (!checks_enabled) {
            return true;
        }

        if (this.checks.total === 0){
            console.log('merge failed: checks total is zero');
            return false;
        }

        return (this.checks.completed >= (this.checks.total - 1)) && (this.checks.success >= (this.checks.total - 1));
    }

    /**
     * Updates Pull with checks data
     * @param {Object} checks check data from pull request
     */
    compileChecks(checks, currentWorkflow) {
        console.log('currentWorkflow', currentWorkflow)
        if (!!checks && !!checks.data) {
            let compiled = {
                total: 0,
                completed: 0,
                success: 0
            };

            const data = checks.data.check_runs;

            if (data && Object.keys(data).length > 0) {
                data.forEach(element => {
                    if (element.name == currentWorkflow) {
                        return;
                    }

                    if (element.status === "completed") {
                        compiled.completed++;
                    }

                    if (element.conclusion === "success") {
                        compiled.success++;
                    }

                    compiled.total++;
                });
            }

            this.checks = compiled;
        }
    }

    /**
     * Determines if the pull request can be merged
     * @param {Config} config configuration
     */
    canMerge(config) {
        return config.labels.every(x => this.labels.includes(x)) &&
            config.blocking_labels.every(x => !this.labels.includes(x)) &&
            this.isReviewComplete(config.review_required, this.requested_reviewers, this.reviews) &&
            this.isChecksComplete(config.checks_enabled);
    }
}

module.exports = Pull;
