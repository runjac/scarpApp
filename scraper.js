const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/scrape', async (req, res) => {
    const { curp } = req.body;

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto('https://www.gob.mx/curp/');
        await page.type('#curpinput', curp);
        await page.click('#searchButton');

        await page.waitForSelector('.panel-body', { timeout: 5000 });

        const data = await page.evaluate(() => {
            const curpData = {};
            const fields = [
                'CURP:', 'Nombre(s):', 'Primer apellido:', 'Segundo apellido:',
                'Sexo:', 'Fecha de nacimiento:', 'Nacionalidad:',
                'Entidad de nacimiento:', 'Documento probatorio:'
            ];

            fields.forEach((field, index) => {
                const value = document.querySelector('.panel-body tr:nth-child(' + (index + 1) + ') td:nth-child(2)').innerText;
                curpData[field.trim()] = value.trim();
            });

            return curpData;
        });

        await browser.close();
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error al obtener los datos.');
    }
});

app.post('/calculate-rfc', async (req, res) => {
    const { nombre, primerApellido, segundoApellido, dia, mes, anio } = req.body;

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto('https://consisa.com.mx/rfc');

        await page.type('#strNombre', nombre);
        await page.type('#strPrimerApellido', primerApellido);
        await page.type('#strSegundoApellido', segundoApellido);
        await page.select('#strdia', dia);
        await page.select('#strmes', mes);
        await page.select('#stranio', anio);

        await page.click('.ui.primary.button');

        await page.waitForSelector('.ui.striped.table', { timeout: 10000 });

        const result = await page.evaluate(() => {
            const resultData = {};
            const rows = document.querySelectorAll('.ui.striped.table tbody tr');
            rows.forEach(row => {
                const key = row.querySelector('td').innerText.trim();
                const value = row.querySelector('td:nth-child(2)').innerText.trim();
                resultData[key] = value;
            });
            return resultData;
        });

        await browser.close();
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error al calcular el RFC.');
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
