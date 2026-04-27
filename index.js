#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { Keplars } from 'keplars';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import ora from 'ora';
import boxen from 'boxen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(os.homedir(), '.keplars-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function showWelcomeScreen() {
  clearScreen();
  
  const title = figlet.textSync('KEPLARS CLI', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  console.log(gradient.rainbow.multiline(title));
  
  const subtitle = chalk.cyan.bold('╔══════════════════════════════════════════════════════════╗');
  const content = chalk.white.bold('║         Email Automation avec votre propre compte         ║');
  const line2 = chalk.white.bold('║              Connectez-vous et envoyez librement            ║');
  const footer = chalk.cyan.bold('╚══════════════════════════════════════════════════════════╝');
  
  console.log(subtitle);
  console.log(content);
  console.log(line2);
  console.log(footer);
  console.log();
  
  await sleep(1500);
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
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
  if (!fs.existsSync(CONTACTS_FILE)) {
    const defaultContacts = [
      "delivered@resend.dev",
      "bounced@resend.dev",
      "complained@resend.dev"
    ];
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(defaultContacts, null, 2));
    return defaultContacts;
  }
  try {
    return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function setupUser() {
  console.log(chalk.yellow.bold('\n📋 PREMIÈRE CONFIGURATION\n'));
  
  const email = await ask(chalk.cyan('✉️  Votre email Gmail: '));
  
  if (!isValidEmail(email)) {
    console.log(chalk.red.bold('\n❌ Email invalide!'));
    process.exit(1);
  }
  
  console.log(chalk.cyan('\n🔑 OBTENTION DE VOTRE CLÉ API KEPLARS\n'));
  console.log(chalk.white('1. Ouvrez https://keplars.email'));
  console.log(chalk.white('2. Créez un compte et connectez-vous avec'));
  console.log(chalk.white(`   votre email: ${chalk.cyan(email)}`));
  console.log(chalk.white('3. Autorisez l\'accès à votre compte Gmail (OAuth)'));
  console.log(chalk.white('4. Allez dans Dashboard > API Keys'));
  console.log(chalk.white('5. Copiez votre clé API\n'));
  
  const apiKey = await ask(chalk.cyan('🔐 Votre clé API Keplars: '));
  
  if (!apiKey || apiKey.length < 10) {
    console.log(chalk.red.bold('\n❌ Clé API invalide!'));
    process.exit(1);
  }
  
  const config = {
    userEmail: email,
    keplarsApiKey: apiKey,
    setupComplete: true
  };
  
  saveConfig(config);
  
  console.log(chalk.green.bold('\n✅ Configuration terminée avec succès!\n'));
  await sleep(1500);
  
  return config;
}

async function getConfig() {
  const config = loadConfig();
  
  if (!config.setupComplete) {
    return await setupUser();
  }
  
  return config;
}

async function sendEmail(keplars, to, subject, text) {
  const spinner = ora({
    text: chalk.cyan(`📧 Envoi à ${to}...`),
    spinner: 'dots12',
    color: 'cyan'
  }).start();
  
  try {
    const response = await keplars.send({
      to: to,
      subject: subject,
      text: text
    });
    
    spinner.succeed(chalk.green.bold(`✓ Envoyé à ${to}`));
    console.log(chalk.gray(`  ID: ${response.id}`));
    return true;
  } catch (err) {
    spinner.fail(chalk.red.bold(`✖ Échec: ${to}`));
    console.log(chalk.gray(`  Erreur: ${err.message}`));
    return false;
  }
}

function showMainMenu() {
  clearScreen();
  
  console.log(gradient.pastel.multiline(`
╔═══════════════════════════════════════════════════════════╗
║                     MENU PRINCIPAL                        ║
╚═══════════════════════════════════════════════════════════╝
  `));
  
  const menu = boxen(
    chalk.white.bold('1. ') + chalk.cyan('📨 Envoyer aux contacts prédéfinis\n') +
    chalk.white.bold('2. ') + chalk.cyan('✏️  Envoyer à des emails personnalisés\n') +
    chalk.white.bold('3. ') + chalk.cyan('🔧 Reconfigurer mon compte\n') +
    chalk.white.bold('4. ') + chalk.red('🚪 Quitter'),
    {
      padding: 2,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      backgroundColor: 'black'
    }
  );
  
  console.log(menu);
  console.log();
}

async function sendToPredefined(keplars) {
  const contacts = loadContacts();
  
  clearScreen();
  
  console.log(chalk.magenta.bold('\n📋 CONTACTS PRÉDÉFINIS\n'));
  
  if (!contacts.length) {
    console.log(chalk.red('Aucun contact trouvé dans contacts.json'));
    console.log(chalk.gray('Créez ce fichier avec une liste d\'emails'));
    await ask(chalk.cyan('\nAppuyez sur Entrée pour continuer...'));
    return;
  }
  
  contacts.forEach((email, index) => {
    const num = (index + 1).toString().padStart(2, ' ');
    console.log(chalk.white(`  ${chalk.cyan(num)}. ${email}`));
  });
  
  console.log();
  const selection = await ask(chalk.cyan(`📌 Choisissez jusqu'à 5 numéros (ex: 1,3,5): `));
  
  const indexes = [...new Set(
    selection
      .split(',')
      .map((n) => parseInt(n.trim(), 10) - 1)
      .filter((n) => n >= 0 && n < contacts.length)
  )].slice(0, 5);
  
  if (!indexes.length) {
    console.log(chalk.red('\n❌ Sélection invalide!'));
    await ask(chalk.cyan('\nAppuyez sur Entrée pour continuer...'));
    return;
  }
  
  const selectedContacts = indexes.map(i => contacts[i]);
  
  console.log(chalk.green(`\n✓ ${selectedContacts.length} contact(s) sélectionné(s)\n`));
  
  const subject = await ask(chalk.cyan('📝 Sujet: '));
  const message = await ask(chalk.cyan('💬 Message:\n'));
  
  console.log(chalk.yellow.bold('\n📊 RÉSUMÉ DE L\'ENVOI\n'));
  console.log(chalk.white(`  Destinataires: ${selectedContacts.length}`));
  console.log(chalk.white(`  Sujet: ${subject}`));
  console.log(chalk.gray(`\n  Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`));
  
  const confirm = await ask(chalk.cyan('\n✨ Confirmer l\'envoi ? (o/N): '));
  
  if (confirm.toLowerCase() !== 'o') {
    console.log(chalk.yellow('\n❌ Envoi annulé'));
    await ask(chalk.cyan('\nAppuyez sur Entrée pour continuer...'));
    return;
  }
  
  console.log(chalk.cyan('\n🚀 DÉBUT DE L\'ENVOI\n'));
  
  let successCount = 0;
  for (const email of selectedContacts) {
    const success = await sendEmail(keplars, email, subject, message);
    if (success) successCount++;
    await sleep(1500);
  }
  
  console.log(chalk.green.bold(`\n✅ ENVOI TERMINÉ: ${successCount}/${selectedContacts} réussi(s)\n`));
  await ask(chalk.cyan('Appuyez sur Entrée pour continuer...'));
}

async function sendToCustom(keplars) {
  clearScreen();
  
  console.log(chalk.magenta.bold('\n✏️  ENVOI PERSONNALISÉ\n'));
  
  const emailsInput = await ask(chalk.cyan('📧 Entrez jusqu\'à 5 emails (séparés par des virgules):\n> '));
  
  const emails = emailsInput
    .split(',')
    .map((e) => e.trim())
    .filter(isValidEmail)
    .slice(0, 5);
  
  if (!emails.length) {
    console.log(chalk.red('\n❌ Aucun email valide fourni!'));
    await ask(chalk.cyan('\nAppuyez sur Entrée pour continuer...'));
    return;
  }
  
  console.log(chalk.green(`\n✓ ${emails.length} email(s) valide(s)\n`));
  
  const subject = await ask(chalk.cyan('📝 Sujet: '));
  const message = await ask(chalk.cyan('💬 Message:\n'));
  
  console.log(chalk.yellow.bold('\n📊 RÉSUMÉ DE L\'ENVOI\n'));
  emails.forEach((email, i) => {
    console.log(chalk.white(`  ${i+1}. ${email}`));
  });
  console.log(chalk.white(`\n  Sujet: ${subject}`));
  console.log(chalk.gray(`\n  Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`));
  
  const confirm = await ask(chalk.cyan('\n✨ Confirmer l\'envoi ? (o/N): '));
  
  if (confirm.toLowerCase() !== 'o') {
    console.log(chalk.yellow('\n❌ Envoi annulé'));
    await ask(chalk.cyan('\nAppuyez sur Entrée pour continuer...'));
    return;
  }
  
  console.log(chalk.cyan('\n🚀 DÉBUT DE L\'ENVOI\n'));
  
  let successCount = 0;
  for (const email of emails) {
    const success = await sendEmail(keplars, email, subject, message);
    if (success) successCount++;
    await sleep(1500);
  }
  
  console.log(chalk.green.bold(`\n✅ ENVOI TERMINÉ: ${successCount}/${emails.length} réussi(s)\n`));
  await ask(chalk.cyan('Appuyez sur Entrée pour continuer...'));
}

async function reconfigurer() {
  console.log(chalk.yellow.bold('\n🔄 RECONFIGURATION DU COMPTE\n'));
  
  const confirm = await ask(chalk.red('⚠️  Cette action effacera votre configuration actuelle. Continuer ? (o/N): '));
  
  if (confirm.toLowerCase() !== 'o') {
    console.log(chalk.yellow('\n❌ Reconfiguration annulée'));
    await sleep(1000);
    return;
  }
  
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
  
  console.log(chalk.green('\n✅ Configuration effacée. Redémarrage...\n'));
  await sleep(1500);
  
  await main();
}

function showGoodbye() {
  clearScreen();
  
  const goodbyeFiglet = figlet.textSync('BYE BYE!', {
    font: 'Small',
    horizontalLayout: 'default'
  });
  
  console.log(gradient.pastel.multiline(goodbyeFiglet));
  console.log(chalk.cyan.bold('\nMerci d\'avoir utilisé Keplars CLI\n'));
  console.log(chalk.gray('Fermeture dans 2 secondes...\n'));
}

async function main() {
  await showWelcomeScreen();
  
  const config = await getConfig();
  
  const keplars = new Keplars({ apiKey: config.keplarsApiKey });
  
  console.log(chalk.green.bold(`✓ Connecté en tant que: ${config.userEmail}\n`));
  await sleep(1000);
  
  while (true) {
    showMainMenu();
    
    const choice = await ask(chalk.cyan('👉 Votre choix: '));
    
    if (choice === '1') {
      await sendToPredefined(keplars);
    } else if (choice === '2') {
      await sendToCustom(keplars);
    } else if (choice === '3') {
      await reconfigurer();
    } else if (choice === '4') {
      showGoodbye();
      await sleep(2000);
      break;
    } else {
      console.log(chalk.red.bold('\n❌ Option invalide!'));
      await sleep(1000);
    }
  }
  
  rl.close();
  process.exit(0);
}

process.on('SIGINT', () => {
  console.log(chalk.red.bold('\n\n⚠️  Interruption détectée. Fermeture propre...\n'));
  rl.close();
  process.exit(0);
});

main();