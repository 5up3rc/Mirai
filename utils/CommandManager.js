var reload	= require('require-reload')(require),
	fs		= require('fs'),
	Command	= reload('./Command.js');

/**
* @class
* @classdesc Handles a directory of .js files formatted as {@link Command}.
* @prop {String} prefix Prefix for the commands handled by this CommandManager.
* @prop {String} dir="commands/normal/" Path where the commands are located from the root directory.
* @prop {Function} [color=false] Color to log the commands as.
* @prop {Object<Command>} commands The loaded {@link Command}.
*/
class CommandManager {

	/**
	* @constructor
	* @arg {String} prefix Prefix for the commands handled by this CommandManager.
	* @arg {String} dir="commands/normal/" Path to load commands from, from the root directory of the bot.
	* @arg {Function} [color=false] Color to log the commands as.
	*/
	constructor(prefix, dir = 'commands/normal/', color) {
		this.prefix = prefix;
		this.directory = `${__dirname}/../${dir}`;
		this.color = color || false;
		this.commands = {};
	}

	/**
	* Initialize the command manager.
	* Loads each command in the set directory.
	* @returns {Promise}
	*/
	initialize() {
		return new Promise((resolve, reject) => {
			fs.readdir(this.directory, (err, files) => {
				if (err) reject(`Error reading commands directory: ${err}`);
				else if (!files) reject(`No files in directory ${this.directory}`);
				else {
					for (let name of files) {
						if (name.endsWith('.js'))
							try {
								console.log(`${cDebug(' COMMAND MANAGER ')} Added ${name}`);
								this.commands[name.replace(/\.js$/, '')] = new Command(name.replace(/\.js$/, ''), this.prefix, reload(this.directory + name));
							} catch (e) {
								console.error(`Error loading command ${name}: ${e}\n${e.stack}`);
							}
					}
					resolve();
				}
			});
		});
	}

	/**
	* Called when a message is detected with the prefix. Decides what to do.
	* @arg {Eris} bot The client.
	* @arg {Eris.Message} msg The matching message.
	* @arg {Object} config The JSON formatted config file.
	* @arg {settingsManager} settingsManager Used to adjust and get server settings.
	*/
	processCommand(bot, msg, config, settingsManager) {
		let name = msg.content.replace(this.prefix, '').split(' ')[0].toLowerCase();
		if (name === "help")
			return this.help(bot, msg, msg.content.replace(this.prefix + name, '').trim());
		let command = this.checkForMatch(name);
		if (command !== null) {
			let suffix = msg.content.replace(this.prefix + name, '').trim();
			this.logCommand(msg, command.name, msg.cleanContent.replace(this.prefix + name, ''));
			return command.execute(bot, msg, suffix, config, settingsManager);
		}
	}

	/**
	* Checks if there is a matching command in this CommandManager.
	* @arg {String} name The command name to look for.
	* @return {?Command} Returns the matching {@link Command} or false.
	*/
	checkForMatch(name) {
		if (name.startsWith(this.prefix)) //Trim prefix off
			name = name.substr(1);
		for (let key in this.commands) {
			if (key === name || this.commands[key].aliases.includes(name))
				return this.commands[key];
		}
		return null;
	}

	/**
	* Built-in help command
	* If no command is specified it will DM a list of commands.
	* If a command is specified it will send info on that command
	* @arg {Eris} bot The client.
	* @arg {Eris.Message} msg The message that triggered the command.
	* @arg {String} [command] The command to get help for.
	*/
	help(bot, msg, command) {
		this.logCommand(msg, 'help', msg.cleanContent.replace(this.prefix + 'help', ''));
		if (!command) {
			let messageQueue = [];
			let currentMessage = `\n// Here's a list of my commands. For more info do: ${this.prefix}help <command>`;
			for (let cmd in this.commands) {
				if (this.commands[cmd].hidden === true)
					continue;
				let toAdd = this.commands[cmd].helpShort;
				if (currentMessage.length + toAdd.length >= 1900) { //If too long push to queue and reset it.
					messageQueue.push(currentMessage);
					currentMessage = '';
				}
				currentMessage += '\n' + toAdd;
			}
			messageQueue.push(currentMessage);
			bot.getDMChannel(msg.author.id).then(chan => {
				let sendInOrder = setInterval(() => { //eslint-disable-line no-unused-vars
					if (messageQueue.length > 0)
						bot.createMessage(chan.id, '```glsl' + messageQueue.shift() + '```'); //If still messages queued send the next one.
					else clearInterval(sendInOrder);
				}, 300);
			});

		} else {
			let cmd = this.checkForMatch(command);
			if (cmd === null) //If no matching command
				bot.createMessage(msg.channel.id, `Command \`${this.prefix}${command}\` not found`);
			else
				bot.createMessage(msg.channel.id, cmd.helpMessage);
		}
	}

	/**
	* Show that a command was executed in the console.
	* @arg {Eris.Message} msg The message object that triggered the command.
	* @arg {String} commandName The name of the executed command.
	* @arg {String} after The text after the command and prefix, cleaned mentions.
	*/
	logCommand(msg, commandName, after) {
		let toLog = '';
		if (msg.channel.guild !== null)
			toLog += `${cServer(msg.channel.guild.name)} >> `;
		toLog += `${cGreen(msg.author.username)} > `;
		if (this.color !== false)
			toLog += this.color(this.prefix + commandName) + after;
		else
			toLog += this.prefix + commandName + after;
		console.log(toLog);
	}

	/**
	* Reload or load a command.
	* @arg {Eris.Client} bot The Client.
	* @arg {String} channelId The channel to respond in.
	* @arg {String} command The comamnd to reload or load.
	*/
	reload(bot, channelId, command) {
		fs.access(`${this.directory}${command}.js`, fs.R_OK | fs.F_OK, error => {
			if (error)
				bot.createMessage(channelId, 'Command does not exist');
			else {
				try {
					this.commands[command] = new Command(command, this.prefix, reload(`${this.directory}${command}.js`));
					bot.createMessage(channelId, `Command ${this.prefix}${command} loaded`);
				} catch (err) {
					console.log(error);
					bot.createMessage(channelId, `Error loading command: ${error}`);
				}
			}
		});
	}
}

module.exports = CommandManager;
