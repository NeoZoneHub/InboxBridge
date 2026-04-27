#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import ora from 'ora';
import boxen from 'boxen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(os.homedir(), '.resend-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function banner() {
  console.clear();
  const title = figlet.textSync('RESEND CLI', {
    horizontalLayout: 'full'
  });
  console.log(gradient.pastel.multiline(title));
  console.log(
    boxen(
      chalk.green('Secure Email Automation via Resend API'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'cyan'
      }
    )
  );
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function loadContacts() {
  if (!fs.existsSync(CONTACTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function getApiKey() {
  const config = loadConfig();
  if (config.apiKey) return config.apiKey;

  console.log(chalk.yellow('\nAPI Resend non configurée.'));
  const apiKey = (await ask(chalk.cyan('Entrez votre clé API Resend: '))).trim();

  if (!apiKey) {
    console.log(chalk.red('Clé API invalide.'));
    process.exit(1);
  }

  config.apiKey = apiKey;
  saveConfig(config);
  console.log(chalk.green('Clé API enregistrée avec succès.\n'));
  return apiKey;
}

async function sendEmail(resend, payload) {
  const spinner = ora(chalk.cyan(`Envoi à ${payload.to}...`)).start();
  try {
    const { data, error } = await resend.emails.send(payload);
    if (error) {
      spinner.fail(chalk.red(`Échec: ${payload.to} - ${error.message}`));
      return false;
    }
    spinner.succeed(chalk.green(`Envoyé: ${payload.to} | ID: ${data.id}`));
    return true;
  } catch (err) {
    spinner.fail(chalk.red(`Erreur: ${payload.to} - ${err.message}`));
    return false;
  }
}

async function sendToPredefined(resend) {
  const contacts = loadContacts();

  if (!contacts.length) {
    console.log(chalk.red('Aucun contact prédéfini trouvé dans contacts.json'));
    return;
  }

  console.log(chalk.magenta('\nContacts disponibles:'));
  contacts.forEach((email, index) => {
    console.log(chalk.white(`${index + 1}. ${email}`));
  });

  const selection = await ask(chalk.cyan('\nChoisissez jusqu\'à 5 numéros (ex: 1,3,5): '));
  const indexes = [...new Set(
    selection
      .split(',')
      .map((n) => parseInt(n.trim(), 10) - 1)
      .filter((n) => n >= 0 && n < contacts.length)
  )].slice(0, 5);

  if (!indexes.length) {
    console.log(chalk.red('Sélection invalide.'));
    return;
  }

  const subject = await ask(chalk.cyan('Sujet: '));
  const message = await ask(chalk.cyan('Message: '));
  const from = await ask(chalk.cyan('Expéditeur (ex: nom@domaine.com): ')) || 'onboarding@resend.dev';

  if (!isValidEmail(from) && from !== 'onboarding@resend.dev') {
    console.log(chalk.yellow('Attention: L\'email expéditeur pourrait être invalide.'));
  }

  console.log(chalk.yellow(`\nRésumé: ${indexes.length} email(s) à envoyer`));
  const confirm = await ask('Continuer ? (o/N): ');
  if (confirm.toLowerCase() !== 'o') {
    console.log(chalk.yellow('Annulé.'));
    return;
  }

  for (const index of indexes) {
    await sendEmail(resend, {
      from,
      to: contacts[index],
      subject,
      text: message
    });
    await sleep(1000);
  }
  
  console.log(chalk.green('\n✓ Envoi terminé'));
}

async function sendToCustom(resend) {
  const emailsInput = await ask(chalk.cyan('Entrez jusqu\'à 5 emails séparés par des virgules: '));
  const emails = emailsInput
    .split(',')
    .map((e) => e.trim())
    .filter(isValidEmail)
    .slice(0, 5);

  if (!emails.length) {
    console.log(chalk.red('Aucun email valide fourni.'));
    return;
  }

  const subject = await ask(chalk.cyan('Sujet: '));
  const message = await ask(chalk.cyan('Message: '));
  const from = await ask(chalk.cyan('Expéditeur (ex: nom@domaine.com): ')) || 'onboarding@resend.dev';

  if (!isValidEmail(from) && from !== 'onboarding@resend.dev') {
    console.log(chalk.yellow('Attention: L\'email expéditeur pourrait être invalide.'));
  }

  console.log(chalk.yellow(`\nRésumé: ${emails.length} email(s) à envoyer`));
  const confirm = await ask('Continuer ? (o/N): ');
  if (confirm.toLowerCase() !== 'o') {
    console.log(chalk.yellow('Annulé.'));
    return;
  }

  for (const email of emails) {
    await sendEmail(resend, {
      from,
      to: email,
      subject,
      text: message
    });
    await sleep(1000);
  }
  
  console.log(chalk.green('\n✓ Envoi terminé'));
}

async function main() {
  banner();
  const apiKey = await getApiKey();
  const resend = new Resend(apiKey);

  console.log(chalk.yellow('\n1. Envoyer aux contacts prédéfinis'));
  console.log(chalk.yellow('2. Envoyer à des emails personnalisés'));
  console.log(chalk.yellow('3. Quitter'));

  const choice = await ask(chalk.cyan('\nChoisissez une option: '));

  if (choice === '1') {
    await sendToPredefined(resend);
  } else if (choice === '2') {
    await sendToCustom(resend);
  } else if (choice === '3') {
    console.log(chalk.yellow('Au revoir!'));
  } else {
    console.log(chalk.red('Option invalide.'));
  }

  rl.close();
}

process.on('SIGINT', () => {
  console.log(chalk.red('\nInterruption détectée.'));
  rl.close();
  process.exit(0);
});

main();