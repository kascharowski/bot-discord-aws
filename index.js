require('dotenv').config()
const { Client } = require('discord.js');
// Intents can be calculated at: https://ziad87.net/intents/
const client = new Client({ intents: 513 });
const aws = require('aws-sdk');

const awsOptions = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
}
const secretsManager = new aws.SecretsManager(awsOptions);
let nextToken = ''

const listSecrets = async (params) => {
  try {
    const data = await secretsManager.listSecrets(params).promise()
    if (!data || data.SecretList.length === 0) {
      console.log('No secrets found')
      throw new Error('No secrets found')
    }
    const dataFilter = data.SecretList.filter(secret => secret.Name.search("development") != -1)
    if(data.NextToken){
      nextToken = data.NextToken
    }
    return dataFilter
  } catch (error) {
    console.log(error)
    throw error
  }
}

const getNextValues = async (token) => {
  const params = {
    SortOrder: "asc",
    NextToken: token
  }
  const data = await secretsManager.listSecrets(params).promise()
  return data
}

const formatListMessage = (data) => {
  let message = ''
  data.forEach(secret => {
    message += `\`${secret.Name}\`\n`
  })
  return message
}

const formatSecretValuesMessage = (secret) => {
  try {
    // If message is too long split it into multiple messages
    let message = ''
    let messageArray = []

    for(let key in secret){
      // Before adding the key to the message, check if the message is too long(2000 characters)
      if(message.length + key.length + secret[key].length + 1 > 2000){
        messageArray.push(message)
        message = ''
      } else {
        // On mongoDB secrets, remove user and password from connection string, all after: mongodb:// and before @, and replace with <user>:<password>
        if(key.search("mongoDB") != -1){
          secret[key] = secret[key].replace(/mongodb:\/\/(.*)@/, "mongodb://<user>:<password>@")
        }
        // If key is a password, replace value with <password>
        if(key.toLowerCase().search("password") != -1){
          secret[key] = "<password>"
        }
        message += `\`${key}: ${secret[key]}\`\n`
      }
    }
    return messageArray
  } catch (error) {
    console.log('error', error)
  }
}

client.on('ready', () => {
  console.log(`Logged as: ${client.user.tag}!`);
});

client.on('messageCreate', async msg => {
    let cleanMessage = msg.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    if(msg.author.bot) return;

    if(!cleanMessage.startsWith('!aws')) return;

    if ( (cleanMessage.search("list") != -1) ) {
      const params = {
        Filters: [
          {
            Key: 'name',
            Values: [
              '!development'
            ]
          }
        ],
        SortOrder: "asc"
      }

      listSecrets(params).then(data => {
        if(data.length == 0)
          return msg.channel.send('Nenhum resultado encontrado')

        let message = formatListMessage(data)

        if(nextToken)
          message += '\n Para ver mais resultados, digite: `!aws next`'

        msg.channel.send(message)
      })
      .catch(error => {
        console.log(error)
        msg.channel.send('Houve algum erro, tente novamente mais tarde')
      })
    }

    if ( (cleanMessage.search("next") != -1) ) {
      if(!nextToken)
        return msg.channel.send('Não há mais resultados')

      getNextValues(nextToken).then(data => {
        if(data.SecretList.length == 0)
          return msg.channel.send('Nenhum resultado encontrado')

        let secrets = data.SecretList.filter(secret => secret.Name.search("development") != -1)
        if(secrets.length == 0){

          if(data.NextToken)
            msg.channel.send('Não há resultados válidos nesta página, para ver mais resultados, digite: `!aws next`')
          else
            msg.channel.send('Não há mais resultados')

          return
        }

        let message = formatListMessage(data)
        msg.channel.send(message)

        if(data.NextToken){
          nextToken = data.NextToken
          msg.channel.send('Para ver mais resultados, digite: `!aws next`')
        }
      })
    }

    if ( (cleanMessage.search("secret") != -1) ) {
      try {
        let secretName = cleanMessage.split(' ')[2]
        if(!secretName)
          return msg.channel.send('Nome do Secret não informado')

        let params = {
          SecretId: secretName
        }

        secretsManager.getSecretValue(params, function(err, data) {
          if (err) {
            console.log(err, err.stack);
            msg.channel.send('Problemas ao tentar buscar o Secret')
          }
          else{
            if(data?.SecretString == '')
              msg.channel.send('Secret não encontrado')
            else{
              // Ready each property in data.SecretString object and send it to the channel
              const secret = JSON.parse(data.SecretString)
              const message = formatSecretValuesMessage(secret)
              message.forEach(message => {
                msg.channel.send(message)
              })
            }
          }
        });
      } catch (error) {
        console.log(error)
        msg.channel.send('Houve algum erro, tente novamente mais tarde')
      }
    }
});

client.login(process.env.DISCORD_TOKEN);