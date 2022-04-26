import * as discordJs from 'discord.js';
import * as aws from 'aws-sdk';

require('dotenv').config();

// Intents can be calculated at: https://ziad87.net/intents/
const client = new discordJs.Client({ intents: 513 });

const awsOptions: aws.SecretsManager.ClientConfiguration = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const secretsManager = new aws.SecretsManager(awsOptions);

let nextToken: aws.SecretsManager.NextTokenType;
const acceptedCommands = ['list', 'next', 'secret'];

const listSecrets = async (params: aws.SecretsManager.ListSecretsRequest) => {
  try {
    const data = await secretsManager.listSecrets(params).promise();

    if (!data || data.SecretList.length === 0) { throw new Error('No secrets found'); }

    const dataFilter = data.SecretList.filter((secret) => secret.Name.search('development') !== -1);

    if (data.NextToken) { nextToken = data.NextToken; }

    return dataFilter;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getNextValues = async (token: aws.SecretsManager.NextTokenType) => {
  try {
    const params = {
      Filters: [
        {
          Key: 'name',
          Values: [
            '!development',
          ],
        },
      ],
      SortOrder: 'asc',
      NextToken: token,
    };
    const data = await secretsManager.listSecrets(params).promise();
    return data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const formatListMessage = (data: aws.SecretsManager.SecretListEntry[]) => {
  let message = '';
  data.forEach((secret) => {
    message += `\`${secret.Name}\`\n`;
  });
  return message;
};

const formatSecretValuesMessage = (secret: Object): string[] => {
  try {
    // If message is too long split it into multiple messages
    let message = '';
    const messageArray = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const key in secret) {
      // Before adding the key to the message, check if the message is too long(2000 characters)
      if (message.length + key.length + secret[key].length + 1 > 1999) {
        messageArray.push(message);
        message = '';
      } else {
        // On mongoDB secrets, remove user and password from connection string, all after: mongodb:// and before @, and replace with <user>:<password>
        if (key.search('mongoDB') !== -1) {
          // eslint-disable-next-line no-param-reassign
          secret[key] = secret[key].replace(/mongodb:\/\/(.*)@/, 'mongodb://<user>:<password>@');
        }
        // If key is a password, replace value with <password>
        if (key.toLowerCase().search('password') !== -1) {
          // eslint-disable-next-line no-param-reassign
          secret[key] = '<password>';
        }
        message += `\`${key}=${secret[key]}\`\n`;
      }
    }
    messageArray.push(message);
    return messageArray;
  } catch (error) {
    return console.log('error', error);
  }
};

const checkCommands = (message: string): boolean => {
  if (!acceptedCommands.includes(message.split(' ')[1])) { return false; }

  return true;
};

type discordChannel = discordJs.DMChannel
  | discordJs.PartialDMChannel
  | discordJs.NewsChannel
  | discordJs.TextChannel
  | discordJs.ThreadChannel
  | discordJs.User

const sendMessage = async (message: string, channel: discordChannel) => {
  try {
    await channel.send(message);
  } catch (error) {
    console.log(error);
  }
};

client.on('ready', () => {
  console.log(`Logged as: ${client.user.tag}!`);
});

client.on('messageCreate', async (msg) => {
  const cleanMessage = msg.content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let returnMessage = '';

  if (msg.author.bot) return;

  if (!cleanMessage.startsWith('!aws')) return;

  if (!checkCommands(cleanMessage)) {
    returnMessage = `\`${cleanMessage.split(' ')[1]}\` Não é um comando válido`;
    return sendMessage(returnMessage, msg.channel);
  }

  if ((cleanMessage.search('list') !== -1)) {
    const params = {
      Filters: [
        {
          Key: 'name',
          Values: [
            '!development',
          ],
        },
      ],
      SortOrder: 'asc',
    };

    listSecrets(params).then((data) => {
      if (data.length === 0) { return sendMessage('Nenhum resultado encontrado', msg.channel); }

      const message = formatListMessage(data);

      if (nextToken) { sendMessage('\n Para ver mais resultados, digite: `!aws next`', msg.channel); }

      return sendMessage(message, msg.author);
    })
      .catch((error) => {
        console.log(error);
        msg.channel.send('Houve algum erro, tente novamente mais tarde');
      });
  }

  if ((cleanMessage.search('next') != -1)) {
    if (!nextToken) { return sendMessage('Não há mais resultados', msg.channel); }

    getNextValues(nextToken).then((data) => {
      if (data.SecretList.length === 0) { return sendMessage('Nenhum resultado encontrado', msg.channel); }

      const secrets = data.SecretList.filter((secret) => secret.Name.search('development') !== -1);
      if (secrets.length == 0) {
        if (data.NextToken) {
          sendMessage('Não há resultados válidos nesta página, para ver mais resultados, digite: `!aws next`', msg.channel);
        } else {
          sendMessage('Não há mais resultados', msg.channel);
        }
        return;
      }

      const message = formatListMessage(data.SecretList);
      sendMessage(message, msg.author);

      if (data.NextToken) {
        nextToken = data.NextToken;
        msg.channel.send('Para ver mais resultados, digite: `!aws next`', msg.channel);
      }
    });
  }

  if ((cleanMessage.search('secret') !== -1)) {
    try {
      const secretName = cleanMessage.split(' ')[2];
      if (!secretName) { return sendMessage('Nome do Secret não informado', msg.channel); }

      const params = {
        SecretId: secretName,
      };

      secretsManager.getSecretValue(params, (err, data) => {
        if (err) {
          console.log(err, err.stack);
          sendMessage('Problemas ao tentar buscar o Secret', msg.channel);
        } else {
          if (!data?.SecretString) { throw new Error('Secret não encontrado'); }

          // Ready each property in data.SecretString object and send it to the channel
          const secret = JSON.parse(data.SecretString);
          const message = formatSecretValuesMessage(secret);
          sendMessage(`Enviando dados do projeto: \`${secretName}\`\n`, msg.author);
          sendMessage(`Enviando dados do projeto: \`${secretName}\` para: ${msg.author}\n`, msg.channel);
          message.forEach((message) => {
            sendMessage(message, msg.author);
          });
        }
      });
    } catch (error) {
      console.log(error);
      sendMessage('Houve algum erro, tente novamente mais tarde', msg.channel);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
