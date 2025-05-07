// api/scrape.js
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar las solicitudes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { curp } = req.body;
  
  if (!curp) {
    return res.status(400).json({ error: 'Se requiere el CURP' });
  }
  
  let browser = null;
  
  try {
    console.log(`Iniciando consulta para CURP: ${curp}`);
    
    browser = await chromium.puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    
    // Configurar timeout más largo y navegación
    await page.setDefaultNavigationTimeout(9000); // Vercel tiene un límite de 10 segundos
    await page.setDefaultTimeout(9000);
    
    console.log('Navegando a la página de CURP...');
    await page.goto('https://www.gob.mx/curp/', { waitUntil: 'networkidle2' });
    
    console.log('Ingresando CURP...');
    await page.type('#curpinput', curp);
    await page.click('#searchButton');
    
    // Esperar a que los resultados aparezcan
    console.log('Esperando resultados...');
    await page.waitForSelector('.panel-body', { timeout: 8000 });
    
    console.log('Extrayendo datos...');
    const data = await page.evaluate(() => {
      const curpData = {};
      const fields = [
        'CURP:', 'Nombre(s):', 'Primer apellido:', 'Segundo apellido:',
        'Sexo:', 'Fecha de nacimiento:', 'Nacionalidad:',
        'Entidad de nacimiento:', 'Documento probatorio:'
      ];
      
      try {
        fields.forEach((field, index) => {
          const selector = `.panel-body tr:nth-child(${index + 1}) td:nth-child(2)`;
          const element = document.querySelector(selector);
          
          if (element) {
            curpData[field.trim()] = element.innerText.trim();
          } else {
            curpData[field.trim()] = 'No disponible';
          }
        });
      } catch (err) {
        console.error('Error en la extracción de datos:', err);
      }
      
      return curpData;
    });
    
    console.log('Consulta completada con éxito');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Error en la consulta de CURP:', error);
    return res.status(500).json({ 
      error: 'Error al obtener los datos de CURP',
      message: error.message
    });
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};

// api/calculate-rfc.js
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar las solicitudes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { nombre, primerApellido, segundoApellido, dia, mes, anio } = req.body;
  
  // Validar que todos los campos necesarios estén presentes
  if (!nombre || !primerApellido || !dia || !mes || !anio) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos para calcular el RFC'
    });
  }
  
  let browser = null;
  
  try {
    console.log('Iniciando cálculo de RFC...');
    console.log(`Datos: ${nombre} ${primerApellido} ${segundoApellido}, ${dia}/${mes}/${anio}`);
    
    browser = await chromium.puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    
    // Configurar timeout más corto para Vercel
    await page.setDefaultNavigationTimeout(9000);
    await page.setDefaultTimeout(9000);
    
    console.log('Navegando a la página de cálculo de RFC...');
    await page.goto('https://consisa.com.mx/rfc', { waitUntil: 'networkidle2' });
    
    // Esperar a que el formulario esté disponible
    console.log('Esperando formulario...');
    await page.waitForSelector('#strNombre', { timeout: 8000 });
    
    console.log('Completando formulario...');
    await page.type('#strNombre', nombre);
    await page.type('#strPrimerApellido', primerApellido);
    
    if (segundoApellido) {
      await page.type('#strSegundoApellido', segundoApellido);
    }
    
    // Seleccionar día, mes y año
    await page.select('#strdia', dia);
    await page.select('#strmes', mes);
    await page.select('#stranio', anio);
    
    // Hacer clic en el botón de cálculo
    console.log('Enviando formulario...');
    await page.click('.ui.primary.button');
    
    // Esperar resultados
    console.log('Esperando resultados...');
    await page.waitForSelector('.ui.striped.table', { timeout: 8000 });
    
    // Extraer resultados
    console.log('Extrayendo resultados...');
    const result = await page.evaluate(() => {
      const resultData = {};
      
      try {
        const rows = document.querySelectorAll('.ui.striped.table tbody tr');
        
        if (rows.length === 0) {
          return { error: 'No se encontraron resultados' };
        }
        
        rows.forEach(row => {
          const keyElement = row.querySelector('td');
          const valueElement = row.querySelector('td:nth-child(2)');
          
          if (keyElement && valueElement) {
            const key = keyElement.innerText.trim();
            const value = valueElement.innerText.trim();
            resultData[key] = value;
          }
        });
      } catch (err) {
        console.error('Error en la extracción de datos:', err);
        return { error: 'Error al extraer datos de la tabla' };
      }
      
      return resultData;
    });
    
    console.log('Cálculo de RFC completado');
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error en el cálculo del RFC:', error);
    return res.status(500).json({ 
      error: 'Error al calcular el RFC', 
      message: error.message 
    });
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};

// api/health.js
module.exports = (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'El servidor está funcionando correctamente',
    time: new Date().toISOString()
  });
};