# bot-discord-aws

Discord bot that can be used to interact with AWS services.

## To get started
* Download Node.js https://nodejs.dev/
* Create a discord application here https://discordapp.com/developers/applications/ and create a bot user under it
* Add the bot account to your discord server
* Gather the required credentials and IDs needed from AWS and Discord mentioned in .env file

## Documentation reference
* Discord.js NPM https://www.npmjs.com/package/discord.js
* Discord Developer Portal https://discord.com/developers/docs/intro
* AWS SDK https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SecretsManager.html#getSecretValue-property

## Running the bot

Set up .env variables, example is at .env.example
```sh
  cp .env.example .env
```

Run:
```
npm install
npm run local
```
Commands:
```
!aws (List all available commands)
!aws list (List all development secrets)
!aws secret {secret} (With the secret name, get all the values)
```

## Todo

* Transformar em TypeScript
* Adicionar linting
* Adicionar testes
* Adicionar documentação
* Configurar deploy
* Criar uma lista de comandos disponíveis
  * Se digitar !aws + um comando que não existe, listar os comandos disponíveis
  * Se digitar somente !aws sem ser seguido de nenhum comando, listar os comandos disponíveis
* Criar estrutura de "palavras"/"secrets" que não podem ser lidos