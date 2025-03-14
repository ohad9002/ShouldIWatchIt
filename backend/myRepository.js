const checkIfUserLoginValid = async (uname, pass) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (uname === "john" && pass === "1234") {
                resolve("yayy");
            }
        }, 3000);
    });
}

module.exports.checkIfUserLoginValid = checkIfUserLoginValid;


