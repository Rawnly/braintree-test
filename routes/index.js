const path = require('path');

const braintree = require('braintree');

const Express = require('express');
const flash = require('express-flash');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const session = require('express-session')
const dotenv = require('dotenv').config();

const root = path.join(__dirname, '..');
const app = Express();

// Helpers
const TRANSACTION_SUCCESS_STATUSES = [
    braintree.Transaction.Status.Authorizing,
    braintree.Transaction.Status.Authorized,
    braintree.Transaction.Status.Settled,
    braintree.Transaction.Status.Settling,
    braintree.Transaction.Status.SettlementConfirmed,
    braintree.Transaction.Status.SettlementPending,
    braintree.Transaction.Status.SubmittedForSettlement
]

const createResultObject = transaction => {
    if ( TRANSACTION_SUCCESS_STATUSES.indexOf(transaction.status) !== -1 )
    {
        return {
            header: "Sweet Success!",
            icon: "success",
            message: "Your transaction has been successfully processed."
        }
    } 

    return {
        header: "Transaction Failed!",
        icon: "fail",
        message: `Your transaction has a status of "${transaction.status}"`
    };
}

function formatErrors(errors) {
    var formattedErrors = '';
  
    for (var i in errors) { // eslint-disable-line no-inner-declarations, vars-on-top
      if (errors.hasOwnProperty(i)) {
        formattedErrors += 'Error: ' + errors[i].code + ': ' + errors[i].message + '\n';
      }
    }
    return formattedErrors;
  }90

// Braintree Configuration
const gateway = braintree.connect({
    environment: braintree.Environment.Sandbox,
    merchantId: process.env.MERCHANT_ID,
    publicKey: process.env.PUBLIC_KEY,
    privateKey: process.env.PRIVATE_KEY
  });
  
// Express Configuration
app.set('view engine', 'pug')
app.set('views', path.join(root, 'views'))

app.use(Express.static(path.join(root, 'public')))

app.use(session({
    saveUninitialized: false,
    resave: true,
    secret: 'braintree-test'
}))
app.use(flash())
app.use(morgan('dev'))

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())


// Routes
app.get('/', (req, res) => {
    gateway.clientToken.generate({}, (err, response) => {
        if (err) console.error(err)

        res.render('index', { token: response.clientToken, messages: req.flash('error') })
    })
})

app.get('/transactions/:id', (req, res) => {
    gateway.transaction.find(req.params.id, (err, transaction) => {
        res.render('transaction', { transaction: transaction, result: createResultObject(transaction) })
    })
})

app.post('/checkout', (req, res) => {
    const { amount, payment_method_nonce } = req.body
    let errors;
    
    gateway.transaction.sale({
        amount,
        paymentMethodNonce: payment_method_nonce,
        options: {
            submitForSettlement: true
        }
    }, (err, result) => {
        if ( result.success || result.transaction ) 
        {
            res.redirect(`/transactions/${result.transaction.id}`)
        } else {
            errors = result.errors.deepErrors()

            console.log( formatErrors(errors) )
            req.flash('error', { msg: formatErrors(errors) })
            
            res.redirect('/')
        }
    })
})


app.listen(3000, () => console.log("Listening on port 3000"))