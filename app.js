require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const axios = require("axios");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const geckoCoinIds = require(__dirname + "/public/gecko-coin-ids.json");


// CONFIG
const app = express();
app.set("view engine", "ejs");


//MIDDLEWARE
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// connect to db
mongoose.connect("mongodb://localhost:27017/cryptoDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

// schemas
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    watchList: [String]
});

userSchema.plugin(passportLocalMongoose);

// models & collection creation
const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//ROUTES
app.get("/", function(req, res) {
    axios
    .get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin%2C%20ethereum%2C%20bitcoin-cash%2C%20litecoin&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h")
    .then(resp => {
      res.render("index", {homeTable: resp.data});
    })
    .catch(err => {
      console.log("Error fetching data from coin gecko", err);
    });
});

app.get("/price", function(req, res) {
    res.redirect("/price/page/1");
});

app.get("/price/:coin", function(req, res) {
    const coin = req.params.coin;
    const currentTime = new Date().getTime();
    
    axios.all([axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin}&order=market_cap_desc&per_page=1&page=1&sparkline=false&price_change_percentage=24h
    `), axios.get(`https://api.coingecko.com/api/v3/coins/${coin}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false
    `), axios.get(`https://api.coingecko.com/api/v3/coins/${coin}/market_chart/range?vs_currency=usd&from=1422577232&to=${currentTime}
    `)])
     .then(axios.spread((firstResponse, secondResponse, thirdResponse) => { 
        let chartData = thirdResponse.data.prices;
        let reformChartData = chartData.map(function(elem) { 
            return { 
              x: elem[0], 
              y: elem[1] 
            }; 
          });
         res.render("coin", {summary: firstResponse.data[0], description: secondResponse.data.description.en.replace(/<\/?a[^>]*>/g, ""), reformCharData: reformChartData});
     }))
     .catch(error => console.log(error));
});

app.get("/price/page/:page", function(req, res) {
    const page = req.params.page;
    if(page<=153) {
        axios
        .get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=${page}&sparkline=false&price_change_percentage=24h`)
        .then(resp => {
        res.render("price", {priceTable: resp.data, currentPage: page});
        })
        .catch(err => {
        console.log("Error fetching data from coin gecko", err);
        });
    } else {
        res.redirect("/price/1");
    }
    
});

app.get("/signup", function(req, res) {
    res.render("signup")
});

app.get("/signin", function(req, res) {
    res.render("signin");
});

app.get("/dashboard", function(req, res) {
    if(req.isAuthenticated()) {
        if(req.user.watchList.length>0) {
            const watchListIds = req.user.watchList.join("%2C%20");
            axios
            .get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${watchListIds}&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`)
            .then(resp => {
            res.render("dashboard", {watchList: resp.data});
            })
            .catch(err => {
            console.log("Error fetching data from coin gecko", err);
        });
        } else {
            res.render("dashboard", {watchList: null})
        }
    } else {
        res.redirect("/signin");
    }
});

app.post("/dashboard", function(req, res) {
    if(req.isAuthenticated()) {
        const coinId = req.body.coinId
        req.user.watchList.push(coinId);
        req.user.save();
        res.redirect("/dashboard");
    } else {
        console.log("hit redirect sign in");
        res.redirect("/signin");
    }
});

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
})

app.post("/signup", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
       if(err) {
           console.log(err);
           res.redirect("/signup");
       } else {
           passport.authenticate("local")(req, res, function() {
               res.redirect("/dashboard");
           });
       }
    });
});

app.post('/signin', passport.authenticate('local', { successRedirect: "/dashboard",failureRedirect: "/signin"}));

// start server
app.listen(3000, function() {
    console.log("Server running on port 3000");
});