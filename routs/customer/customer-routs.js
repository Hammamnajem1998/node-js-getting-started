const { app } = require('../../config/app/app-config/app-config');
const { passport} = require('../../config/authentication/authentication-config/authentication-config');
const { signinSchema, signupSchema } = require('../../config/validation/validation-config/validation-config');
const LocalStrategy = require('passport-local').Strategy;

const mysql = require('mysql');
// for mysql local
// var con = mysql.createConnection({
//     host: "localhost",
//     user: "root",
//     password: "root",
//     database: "temp_schema"
// });

// for mysql heroku database (cloud)
var con = mysql.createConnection({
    host: "us-cdbr-east-03.cleardb.com",
    user: "bca894223fa92f",
    password: "bd33beab",
    database: "heroku_5dbb5278d6f4a3f"
});
// handle database disconnecting error
function handleError() {
    con.on('error', err =>{
        if(err.code === 'PROTOCOL_CONNECTION_LOST'){
            con = mysql.createConnection({
                host: "us-cdbr-east-03.cleardb.com",
                user: "bca894223fa92f",
                password: "bd33beab",
                database: "heroku_5dbb5278d6f4a3f"
            });
            
            handleError();
        }
        else {
            throw err;
        }
    });
};
handleError();

// authentication
passport.use(new LocalStrategy(
    {   // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
    },
    (email, password, done)=>{
      const sql1 = `select * from users WHERE email= '${email}'; `;
      con.query(sql1, (err, user) =>{
          if (err) return done(err);
          if(!user[0]) return done(null, false, 'Email not found');
          if(password != user[0].password) return done(null, false, 'Incorrect password.');
          return done(null, user[0]);
      });   
}));


// sign up
app.post('/signup', (req, res) =>{
    const {error, value} = signupSchema.validate({username: req.body.first_name, email: req.body.email, password: req.body.password});
    if (error) return res.status(400).json({error: error.message});

    const sql1 = `INSERT INTO users (first_name, last_name, email, password, location) 
    VALUES ('${req.body.first_name}', '${req.body.last_name}', '${req.body.email}','${req.body.password}', 
    ST_GeomFromText('POINT(${req.body.location.latitude} ${req.body.location.longitude})') );`;
    
    con.query(sql1, (err, result) =>{
        if (err) return res.status(400).json({error: err.sqlMessage});
        return res.status(200).json({message: "added", id: result.insertId});
    });
});

// login
app.post('/login', (req, res, next)=> {
    const {error, value} = signinSchema.validate({email: req.body.email, password: req.body.password});
    if (error) return res.status(400).json({error: error.message});
    passport.authenticate('local', (err, user, info) => {
      if (err) return  next(err); //res.json({error: err})
      if (!user) return res.json({error: 'not authorized'})
      return res.json({message: user});
    })(req, res, next);
});

// get user information
app.get('/user/:id', (req, res) =>{

    const sql1 = `select * from users WHERE id = '${req.params.id}'; `;
    con.query(sql1, (err, user) =>{
        if(err) return res.status(404).json({error : err});
        return res.send(user[0]);
    });
  
});
  
// get all users
app.get('/users', (req, res) =>{
    
    const sql1 = `select * from users;`;
    con.query(sql1, (err, users) =>{
        if (err) return res.status(404).json({error : err});
        if(!users[0]) return res.status(404).json({error: 'No users'});
        return res.send(users);
    });   

});

//delete all shops
app.delete('/users', (req, res) =>{

    const sql1 = `delete from users ;`;
    con.query(sql1, (err, shops) =>{
        if (err) return res.status(400).json({error: err.sqlMessage});
        return res.send(shops);
    });
});

// update user information
app.post('/update', (req, res) =>{

    var sql1 = ``;
    if(req.body.firstName != null){
        sql1 = `UPDATE users SET first_name = '${req.body.firstName}' WHERE email = '${req.body.email}';`;
    }
    else if(req.body.lastName != null){
        sql1 = `UPDATE users SET last_name = '${req.body.lastName}' WHERE email = '${req.body.email}';`;
    }
    else if(req.body.password != null){
        sql1 = `UPDATE users SET password = '${req.body.password}' WHERE email = '${req.body.email}';`;
    }

    con.query(sql1, (err, result) =>{
        if (err) return res.status(400).json({error: err.sqlMessage});
        return res.status(200).json({message: "updated", result: result});
    });
});

// update  user image
app.post('/image', (req, res) =>{
    if(req.body.url == null || req.body.email == null ) return res.status(400).json({error: 'bad request'});

    var sql1 = `UPDATE users SET photo = '${req.body.url}' WHERE email = '${req.body.email}';`;
    con.query(sql1, (err, result) =>{
        if (err) return res.status(400).json({error: err.sqlMessage});
        return res.status(200).json({message: "updated", result: result});
    });
});

// get user's liked shops
app.get('/user/like/:id', (req, res) =>{

    const sql1 = `select * from rates where user = ${req.params.id} and rate > 3.0;`;
    con.query(sql1, (err, rates) => {
        if (err) return res.status(404).json({error : err});

        // delete duplicates rates from "rates" array.
        const uniqueArray = rates.filter((rate1, index) => {
            const _rate = JSON.stringify({user:rate1.user, shop:rate1.shop});
            return index === rates.findIndex(rate2 => {
              return JSON.stringify({user:rate2.user, shop:rate2.shop}) === _rate;
            });
        });
 
        // mapping each rates with shops
        var liked_shops_array = [];
        const sql2 = `select * from shops;`;
        con.query(sql2, (err, shops) =>{
            if (err) return res.status(400).json({error: err.sqlMessage});
            if (!shops[0]) return res.status(200).json({error: 'No shops'});

            shops.forEach(shop => {
                if(uniqueArray.find(rate => rate.shop == shop.id) != null) liked_shops_array.push(shop);
            });

            return res.json({message:liked_shops_array, length:liked_shops_array.length});
        });

    });
});