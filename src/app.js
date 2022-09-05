import express  from "express";
import cors from "cors";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
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
        await db.collection("messages").insertOne({
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

app.post("/messages", async(req, res) => {
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
        const procuraParticipante = await db.collection("participants").find({"name": to}).toArray();
        if(procuraParticipante.length < 1 && to !== "Todos"){
            return  res.status(422).send("O destinatário não está na sala!");
        }
        const message = {
            "from": `${user}`,
            ...req.body,
            "time": `${dayjs().format("HH:mm:ss")}`
        }
        await db.collection("messages").insertOne(message);
        return res.sendStatus(201)
    }catch(error){
        res.status(500).send(error.message)
    }
})

app.get("/messages", async (req,res)=>{
    const {user} = req.headers;
    try{
        const mensagens = await db.collection("messages").find().toArray();
        const aux = mensagens.filter(message => message.to === "Todos" || message.to === user || message.from === user);
        if(req.query.limit){
            const limit = parseInt(req.query.limit);
            return res.status(200).send(aux.slice(limit*(-1)));
        };

        return res.status(200).send(aux)
    }catch(error){
        return res.status(500).send(error.message);  
    } 
})

//status

app.post("/status", async (req, res)=> {
    const {user} = req.headers;
    try{
        const participante = await db.collection("participants").find({"name": user}).toArray();
        if(participante.length < 1){return res.sendStatus(404)};

        await db.collection("participants").updateOne({"name":user},{ "$set": {"lastStatus": Date.now()}});
        return res.sendStatus(200)

    }catch(error){
        return res.status(500).send(error.message);
    }
})

//remoção de inativos

setInterval(async () => {
    const participantes = await db.collection("participants").find().toArray();
    const aux = participantes.filter(value => (Date.now() - value.lastStatus) > 10000) 
    aux.map(async (value)=>{
       await db.collection("participants").deleteOne({_id: value._id})
       await db.collection("messages").insertOne({
        "from": `${value.name}`,
        "to": 'Todos', 
        "text": 'Sai da sala...',
        "type": 'status', 
        "time": `${dayjs().format("HH:mm:ss")}`
    });
    })
}, 15000);

// Delete

app.delete("/messages/:ID", async (req, res)=> {
    const {ID} = req.params;
    const {user} = req.headers;

    try{
        const procuraMensagem = await db.collection("messages").find({_id: ObjectId(ID)}).toArray();
        if(procuraMensagem.length<1){return res.sendStatus(404)};
        if(procuraMensagem[0].from !== user){return res.sendStatus(401)};
        await db.collection("messages").deleteOne({_id: ObjectId(ID)});
        res.sendStatus(200);
    }catch(error){
        return res.status(500).send(error.message); 
    }
})




app.listen(5000, () => console.log("Listen on port 5000..."));