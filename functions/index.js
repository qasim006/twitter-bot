const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

const dbRef = admin.firestore().doc('tokens/demo');

const TwitterApi = require('twitter-api-v2').default;
const twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET
});

const callbackURL = "http://127.0.0.1:5000/joblessengr-2024/us-central1/callback"
// STEP 1
exports.auth = functions.https.onRequest(async (request, response) => {

    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
    );

    console.log('response ===', url, codeVerifier, state)

    //store verifier
    await dbRef.set({ codeVerifier, state })
    response.redirect(url);

});

// STEP 2
exports.callback = functions.https.onRequest(async (request, response) => {

    const { state, code } = request.query;

    const dbSnapshot = await dbRef.get();

    const { codeVerifier, state: storedState } = dbSnapshot.data();

    console.log('state, code ===', state, code)

    if (state !== storedState) {
        return response.status(400).send('Stored tokens do not match!');
    }

    const {
        client: loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    console.log('accessToken, refreshToken ===', accessToken, refreshToken)

    await dbRef.set({ accessToken, refreshToken });

    response.sendStatus(200);
});

// STEP 3
exports.tweet = functions.https.onRequest(async (request, response) => {

    const { refreshToken } = (await dbRef.get()).data();

    const {
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({ accessToken, refreshToken: newRefreshToken });

    const { data } = await refreshedClient.v2.me();

    response.send(data);
});