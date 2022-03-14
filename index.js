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

const getNextValues = async (NextToken) => {
  const params = {
    SortOrder: "asc",
    NextToken: NextToken
  }
  const data = await secretsManager.listSecrets(params).promise()
  return data
}

const formatListMessage = (data) => {
  let message = ''
  data.SecretList.forEach(secret => {
    message += `\`${secret.Name}\`\n`
  })
  return message
}

client.on('ready', () => {
  console.log(`Logged as: ${client.user.tag}!`);
});

client.on('messageCreate', async msg => {
    let cleanMessage = msg.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    if(msg.author.bot) return;

    if(!cleanMessage.startsWith('!')) return;

    if ( (cleanMessage.search("aws list") != -1) ) {
      console.log('cleanMessage: ' + cleanMessage)

      let params = {
        Filters: [
          {
            Key: 'name',
            Values: [
              '!development'
            ]
          }
        ],
        SortOrder: "asc"
      };

      secretsManager.listSecrets(params, function(err, data) {
        if (err) console.log(err, err.stack);
        else{
          if(data.SecretList.length == 0)
            msg.channel.send('Nenhum resultado encontrado')

          let secrets = data.SecretList.filter(secret => secret.Name.search("development") != -1)
          if(secrets.length == 0){
            if(data.NextToken)
              msg.channel.send('Não há resultados válidos nesta página, para ver mais resultados, digite: `!aws next`')
          }
          else{
            let message = formatListMessage(data)
            msg.channel.send(message)

            if(data.NextToken){
              console.log('data.NextToken: ' + data.NextToken)
              nextToken = data.NextToken
              msg.channel.send('Para ver mais resultados, digite: `!aws next`')
            }
          }
        }
      });
    }

    if ( (cleanMessage.search("aws next") != -1) ) {
      console.log('cleanMessage next: ' + cleanMessage)
      if(!nextToken)
        return msg.channel.send('Não há mais resultados')

      getNextValues(nextToken).then(data => {
        if(data.SecretList.length == 0)
          msg.channel.send('Nenhum resultado encontrado')

        let secrets = data.SecretList.filter(secret => secret.Name.search("development") != -1)
        if(secrets.length == 0){
          // if mextToken is not null, it means that there are more results
        }

        let message = formatListMessage(data)
        msg.channel.send(message)

        if(data.NextToken){
          console.log('data.NextToken: ' + data.NextToken)
          nextToken = data.NextToken
          msg.channel.send('Para ver mais resultados, digite: `!aws next`')
        }
      })

      // secretsManager.listSecrets(params, function(err, data) {
      //   if (err) console.log(err, err.stack);
      //   else{
      //     if(data.NextToken){
      //       console.log('data.NextToken: ' + data.NextToken)
      //       nextToken = data.NextToken
      //       msg.channel.send('Para ver mais resultados, digite `!aws next`')
      //     }
      //     let secrets = data.SecretList.filter(secret => secret.Name.search("development") != -1)
      //     console.log('secrets length: ' + secrets.length)
      //     // send one message with each secret name to the channel with for of
      //     let message = ''
      //     for(let secret of secrets){
      //       message += '`' + secret.Name + '`\n'
      //     }
      //     msg.channel.send(`${message}`)
      //   }
      // });
    }

    // if aws secret + secret name
    if ( (cleanMessage.search("aws secret") != -1) ) {
      console.log('cleanMessage: ' + cleanMessage)
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
            // stringify the secret
            // let secretData = JSON.parse(data.SecretString)
            let message = data.SecretString
            msg.channel.send(message)
          }
        }
      });
    }
});

client.login(process.env.DISCORD_TOKEN);