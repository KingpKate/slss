// Script to set system mode to production
const fs = require('fs');
const path = require('path');

// Create a simple HTML file that will run in the browser to update localStorage
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Set Production Mode</title>
</head>
<body>
    <h1>Setting System Mode to Production...</h1>
    <script>
        // Update system settings to production mode
        const systemSettings = {
            systemMode: 'production',
            productionOperators: []
        };
        localStorage.setItem('slss_system_settings', JSON.stringify(systemSettings));
        
        console.log('✅ System mode set to production!');
        console.log('✅ Database connection should now be active.');
        console.log('You can close this window now.');
        
        // Display success message
        document.body.innerHTML = `
            <h1 style="color: green;">✅ Success!</h1>
            <h2>System mode has been set to production.</h2>
            <p>The system should now connect to the MySQL database.</p>
            <p>You can close this window and refresh the SLSS application.</p>
        `;
    </script>
</body>
</html>
`;

// Write the HTML file
const outputPath = path.join(__dirname, 'set-production-mode.html');
fs.writeFileSync(outputPath, htmlContent);

console.log('✅ Created set-production-mode.html');
console.log('');
console.log('To set the system to production mode:');
console.log('1. Open set-production-mode.html in a web browser');
console.log('2. The page will automatically update the system settings');
console.log('3. Close the page and refresh your SLSS application');
console.log('4. The system should now show online status and connect to MySQL');
console.log('');
console.log('Alternative: Run this JavaScript code in the browser console:');
console.log('localStorage.setItem(\'slss_system_settings\', JSON.stringify({ systemMode: \'production\', productionOperators: [] }));');
