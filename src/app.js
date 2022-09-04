import express  from "express";
import cors from "cors";
import joi from "joi";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;

mongoClient.connect().then(()=>{
    db = mongoClient.db("projeto12_uou");
});

const participantsSchema = joi.object({
    name: joi.string().empty().min(3).required()
});

const messageSchema = joi.object({
    to: joi.string().empty().required(),
    text: joi.string().empty().required(),
    type: joi.string().empty().required()
});

// Participantes

app.post("/participants", async (req, res)=> {
    const {name} = req.body;
    const validation = participantsSchema.validate(req.body, {abortEarly: false});
    if(validation.error){
        return res.status(422).send(validation.error.details)
    }
    
    if(name.toLowerCase().includes("calvo") || name.toLowerCase().includes("careca")){
        return  res.status(422).send("Não aceitamos carecas aqui!")
    };

    try{
        const lista = await db.collection("participants").find({"name": name}).toArray();
        if(lista.length > 0){
            return res.status(409).send("Este nome já está sendo usado")
        }
        await db.collection("participants").insertOne({"name": name , "lastStatus": Date.now()});
        await db.collection("message").insertOne({
            "from": `${name}`,
            "to": 'Todos', 
            "text": 'entra na sala...',
            "type": 'status', 
            "time": `${dayjs().format("HH:mm:ss")}`
        });

        res.sendStatus(201);
    }catch(error){
        res.status(500).send(error.message)
    }
});

app.get("/participants", async (req, res)=> {
    try {
        const participantes = await db.collection("participants").find().toArray();
        res.status(200).send(participantes);
    }catch(error){
        res.status(500).send(error.message)
    }
});

//Mensagens

app.post("/message", async(req, res) => {
    const {type, to} = req.body;
    const {user} = req.headers;
    const validation = messageSchema.validate(req.body, {abortEarly: false});
    if(validation.error){
        const erros = validation.error.details.map(error => error.message);
        return res.status(422).send(erros);
    };
    if(type !== "message" && type !== "private_message"){
        return  res.status(422).send("type deve ser 'message' ou 'private_message'!");
    };
    try{
        console.log(to)
        const procuraParticipante = await db.collection("participants").find({"name": to}).toArray();
        if(procuraParticipante.length < 1){
            return  res.status(422).send("O destinatário não está na sala!");
        }
        const message = {
            "from": `${user}`,
            ...req.body,
            "time": `${dayjs().format("HH:mm:ss")}`
        }
        await db.collection("message").insertOne(message);
        return res.sendStatus(201)
    }catch(error){
        res.status(500).send(error.message)
    }
})

app.get("/message", async (req,res)=>{
    const {user} = req.headers;
    try{
        const mensagens = await db.collection("message").find().toArray();
        const aux = mensagens.filter(message => message.to === "Todos" || message.to === user);
        if(req.query.limit){
            const limit = parseInt(req.query.limit);
            return res.status(200).send(aux.slice(limit*(-1)));
        };

        return res.status(200).send(aux)
    }catch(error){
        res.status(500).send(error.message)  
    } 
})

//status






app.listen(5000, () => console.log("Listen on port 5000..."));