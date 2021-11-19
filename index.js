const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
const cors = require('cors');
const objectId = require('mongodb').ObjectId;
require('dotenv').config();
const fileUpload = require('express-fileupload');


// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());
// doctors-portaall-Firebase-admin-sdk.json


const serviceAccount = require("./doctors-portaall-Firebase-admin-sdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Database url
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mc60i.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        await client.connect();
        const database = client.db('doctors-portal');
        const appointmentsCollection = database.collection('appointment');
        const usersCollection = database.collection('users');
        const doctorsCollection = database.collection('doctors');
        const stripe = require("stripe")(process.env.STRIPE_SECRET);



        // varify user tokens and
        async function valifyToken(req, res, next) {
            if (req.headers.authorization.startsWith('Bearer ')) {
                const token = req.headers.authorization.split(' ')[1];

                try {
                    const decodeUser = await admin.auth().verifyIdToken(token);
                    req.docodedEmail = decodeUser.email;
                } catch {

                }
            }
            next();
        }


        // add pataitnet appointments
        app.post('/appointments', async (req, res) => {
            console.log('appointment add api')
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            res.json(result);
        })

        // Update appointment
        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: objectId(id) };
            const updateDoc = {
                $set: {
                    payment: payment
                }
            };
            const result = await appointmentsCollection.updateOne(filter, updateDoc);
            console.log(result);
            res.json(result)

        })

        // get all appointments
        app.get('/appointments', valifyToken, async (req, res) => {
            console.log('get appoinment id via email or date')
            const email = req.query.email;
            const date = new Date(req.query?.date).toLocaleDateString();
            const requester = req.docodedEmail;
            if (requester) {

                const query = { email: email, date: date }
                const cursor = await appointmentsCollection.find(query);
                const appointments = await cursor.toArray();
                res.json(appointments);
            } else {
                res.status(401).json({ message: 'vai ei khane ki' })
            }
        })
        // Add new user 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        })
        // check user exists or not exist & if not exist user create user
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            console.log(result)
        });


        // Make a admin
        app.put('/users/admin', valifyToken, async (req, res) => {
            console.log('Set as a admin')
            const user = req.body;
            const requester = req.docodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === admin) {
                    const filter = { email: user.email }
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            } else {
                res.status(401).json({ message: 'you do not have make admin' });
            }

        });
        // Checking user admin or not admin
        app.get('/users/:email', async (req, res) => {
            console.log('Cheking admin api')
            const email = req.params.email;
            console.log(email);
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.get('/appointment/:id', async (req, res) => {
            console.log('get all appointment');
            const id = req.params.id;
            const query = { _id: objectId(id) };
            console.log(query);
            const result = await appointmentsCollection.findOne(query);
            // console.log(result);

            res.json(result);
        })

        // Add Doctor
        app.post('/addDoctors', async (req, res) => {
            console.log('Add doctor api');
            const name = req.body.name;
            const email = req.body.email;
            const img = req.files.img;
            const imgData = img.data;
            console.log(imgData);
            const encodedPicture = imgData.toString('base64');
            const imageBuffer = Buffer.from(encodedPicture, 'base64');
            const doctor = {
                name, email, img: imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor);
            res.json(result);
        })

        // Get all Doctors fdf
        app.get('/doctors', async (req, res) => {
            const result = await doctorsCollection.find({}).toArray();
            res.json(result);
        })

        // STRIPE
        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            console.log(paymentInfo)
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            });
            res.json({ clientSecrect: paymentIntent.client_secret })
        })


    } finally {

    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Doctors Portal Server Runing');
})

app.listen(port, (req, res) => {
    console.log('Listening Port', port)
})
