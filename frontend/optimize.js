import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const rolesDir = path.join(process.cwd(), 'public', 'roles');

async function processImages() {
    const files = fs.readdirSync(rolesDir).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'));
    
    for (const file of files) {
        const inputPath = path.join(rolesDir, file);
        const outputPath = path.join(rolesDir, file.replace(/\.jpe?g$/, '.webp'));
        
        console.log(`Processing ${file}...`);
        
        await sharp(inputPath)
            .resize(800, 800, {
                fit: 'cover',
                position: 'top'
            })
            .webp({ quality: 85 })
            .toFile(outputPath);
            
        // Delete original jpeg
        fs.unlinkSync(inputPath);
        console.log(`Done -> ${outputPath}`);
    }
    
    console.log('All images optimized!');
}

processImages().catch(console.error);
