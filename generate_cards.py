import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import textwrap

artifact_dir = r"C:\Users\aeker\.gemini\antigravity\brain\b87b7404-3bf3-493d-919c-29ee1dbc11bc"
output_dir = r"C:\Users\aeker\Desktop\kuyu\role_cards"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

roles = {
    "Şifacı (Doctor)": {
        "text": "Gece birini seçip korur (Kendini 2 kez koruma limiti var).",
        "file": "sifaci_portrait_1775140662135.png"
    },
    "Bekçi (Sheriff)": {
        "text": "Gece birini araştırır ve sistem ona kişinin Eşkıya olup olmadığını söyler.",
        "file": "bekci_portrait_1775140676377.png"
    },
    "Avcı (Veteran)": {
        "text": "Gece pusu kurabilir (3 limitli). Pusu kurduğunda evine gelen herkesi vurur, o gece ölmez.",
        "file": "avci_portrait_1775140700550.png"
    },
    "Muhtar (Mayor)": {
        "text": "Gündüzleri tartışma esnasında \"Mührü Vur\" diyerek kimliğini açıklar. Bundan sonra oyu 3 oy sayılır ama Şifacı onu koruyamaz.",
        "file": "muhtar_portrait_1775140719014.png"
    },
    "Dedikoducu (Lookout)": {
        "text": "Gece seçtiği kişinin evini gözetler. O eve o gece kimlerin girdiğini isim isim görür.",
        "file": "dedikoducu_portrait_1775140734613.png"
    },
    "Falcı (Investigator)": {
        "text": "Birine büyü/kurşun döker ve hedef kişinin sahip olabileceği 3 olası rolü sistemden kehanet olarak alır.",
        "file": "falci_portrait_1775140751756.png"
    },
    "Gassal (Medium)": {
        "text": "Geceleri, ölenlerin kendi aralarında konuşabildiği \"Ölüler Boyutu\" sohbetini canlı olarak okuyabilir.",
        "file": "gassal_portrait_1775140781684.png"
    },
    "Eşkıya Başı (Godfather)": {
        "text": "Gece saldırılarına karşı bağışıktır, asıl ölüm emrini o verir. Bekçi, onu araştırsa bile \"Masum\" görür.",
        "file": "eskiyabasi_portrait_1775140796871.png"
    },
    "Kiralık Katil (Mafioso)": {
        "text": "Eşkıya Başı'nın tetikçisidir, o emreder Katil vurur.",
        "file": "kiralikkatil_portrait_1775140812088.png"
    },
    "Münafık (Framer)": {
        "text": "Gece seçtiği hedefe iftira atar; eğer Bekçi o kişiyi aynı gece araştırırsa, hedef \"Eşkıya\" olarak görünür.",
        "file": "munafik_portrait_1775140826808.png"
    },
    "Tefeci (Blackmailer)": {
        "text": "Gece seçtiği kişiye gözdağı verir; hedef kişi ertesi gün tartışma boyunca sohbete hiçbir şey yazamaz. Sadece oylamada oy kullanabilir.",
        "file": "tefeci_portrait_1775140842258.png"
    },
    "Meyhaneci (Consort)": {
        "text": "Gece seçtiği kişinin aklını çeler (Roleblock) ve onun gece aksiyonu yapmasını engeller. (Örn: Şifacı koruyamaz, Katil vuramaz).",
        "file": "meyhaneci_portrait_1775140870981.png"
    },
    "Yanaşma (Survivor)": {
        "text": "Tek amacı oyun sonuna kadar hayatta kalmaktır. Gece 4 defa kapısını arkadan kilitleyerek (Saklanarak) olası saldırılardan kurtulabilir.",
        "file": "yanasma_portrait_1775140887605.png"
    },
    "Köy Delisi (Jester)": {
        "text": "Amacı köylüleri kandırıp kendini gündüz oylamasıyla yaktırmak/astırmaktır. Kuyuya atılırsa, oy verenlerden birine lanet okur ve onu öldürür.",
        "file": "koydelisi_portrait_1775140901903.png"
    },
    "Cinnetkar (Serial Killer)": {
        "text": "Geceleri herkesi tek tek kesmeye çalışan psikopat bir katildir, gece saldırılarına bağışıktır. Masumlar ve Eşkıyalarla düşmandır.",
        "file": "cinnetkar_portrait_1775140979821.png"
    },
    "Kan Davalı (Executioner)": {
        "text": "Sadece oyunda ona rastgele verilen 1 masum \"Hedefini\" gündüz astırmaya çalışır. Hedefi asılırsa kazanır. Hedef gece ölürse Delirip Köy Delisi'ne dönüşür.",
        "file": "kandavali_portrait_1775140936190.png"
    },
    "Kundakçı (Arsonist)": {
        "text": "Gece iki yeteneği vardır: Ya kurbanlarının evine \"Gazyağı Töker\" ya da meşaleyle gazyağı döktüğü herkesin evini aynı anda \"Ateşe Verir\". Bağışıktır.",
        "file": "kundakci_portrait_1775140952850.png"
    }
}

title_font = ImageFont.truetype("segoeui.ttf", 36)
try:
    desc_font = ImageFont.truetype("segoeui.ttf", 24)
except:
    # fallback
    title_font = ImageFont.load_default()
    desc_font = ImageFont.load_default()

for role_name, data in roles.items():
    img_path = os.path.join(artifact_dir, data["file"])
    if not os.path.exists(img_path):
        print(f"Missing {img_path}")
        continue
    
    # create canvas: 900 x 512
    card = Image.new("RGBA", (1000, 512), (30, 30, 35, 255))
    
    # load and paste character portrait
    try:
        portrait = Image.open(img_path).convert("RGBA")
        portrait = portrait.resize((512, 512))
        card.paste(portrait, (0, 0), portrait)
    except Exception as e:
        print(f"Error loading {img_path}: {e}")
        continue
    
    draw = ImageDraw.Draw(card)
    
    # draw dividing line
    draw.line([(512, 50), (512, 462)], fill=(100, 100, 100, 255), width=2)
    
    # draw title
    text_x = 540
    title_y = 60
    draw.text((text_x, title_y), role_name, font=title_font, fill=(240, 230, 200, 255))
    
    # draw description text wrapped
    desc = data["text"]
    wrapped = textwrap.wrap(desc, width=32)
    
    desc_y = 150
    for line in wrapped:
        draw.text((text_x, desc_y), line, font=desc_font, fill=(200, 200, 200, 255))
        try:
            # try to get height using getbbox
            bbox = desc_font.getbbox(line)
            desc_y += (bbox[3] - bbox[1]) + 10
        except AttributeError:
            desc_y += 35
    
    safe_filename = role_name.replace(" ", "_").replace("(", "").replace(")", "").replace("/", "_").replace("Ş", "S").replace("ı", "i").replace("ç", "c").replace("ş", "s").replace("ö", "o").replace("ü", "u").replace("ğ", "g")
    
    output_path = os.path.join(output_dir, f"{safe_filename}.png")
    
    # To fix potential alpha channel issues, composite with a black background and save as RGB
    bg = Image.new("RGB", card.size, (30, 30, 35))
    bg.paste(card, mask=card.split()[3]) # 3 is alpha
    
    bg.save(output_path)
    print(f"Saved {output_path}")

print("Done generating cards.")
