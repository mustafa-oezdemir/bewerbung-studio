# BewerbungsManager – Windows kurulumu

## İndirilecek dosyalar

[GitHub Releases](https://github.com/mustafa-oezdemir/bewerbung-studio/releases/latest) sayfasındaki **Assets** bölümünden Windows x64 için şu dosyalardan birini indirin:

- `BewerbungsManager-<sürüm>-x64-Setup.exe`: Bilgisayara kurulum yapar.
- `BewerbungsManager-<sürüm>-x64-Portable.exe`: Kurulum gerektirmeden çalışır.

İsterseniz aynı bölümdeki `SHA256SUMS.txt` ile indirdiğiniz dosyayı doğrulayın. PowerShell'de dosyanın bulunduğu klasörde `Get-FileHash -Algorithm SHA256 .\BewerbungsManager-<sürüm>-x64-Setup.exe` komutunu çalıştırın ve çıkan değeri listede karşılaştırın.

## Setup ile kurulum

1. Açık BewerbungsManager pencerelerini kapatın.
2. `...-Setup.exe` dosyasını çalıştırıp kurulum adımlarını tamamlayın.
3. Uygulamayı Başlat menüsünden açın. İlk açılışta istenirse **Neuen Bewerbungsordner auswählen** ile başvurular için bir veri klasörü seçin. Mevcut veriniz varsa **Workspace-Datei auswählen …** seçeneğini kullanın.
4. Verilerin yerini daha sonra **Einstellungen → Speicherort** bölümünden görebilirsiniz.

Windows imza uyarısı gösterebilir; yayın dosyalarının imza durumu sürüm sayfasında belirtilir. Yalnızca resmi GitHub sürümünden indirdiğiniz ve doğruladığınız dosyayı çalıştırın.

## Portable sürüm

`...-Portable.exe` dosyasını dilediğiniz bir klasöre koyup çalıştırın. Aynı veri klasörünü Setup sürümüyle kullanacaksanız iki sürümü aynı anda açmayın. Portable EXE'yi silmek, ayrı bir klasörde tuttuğunuz başvuru verilerini silmez.

## Güncelleme ve veri güvenliği

Yeni sürümü kurmadan önce **Einstellungen → Übertragen & Sicherung** üzerinden veri yedeği oluşturun ve yedeği farklı bir konuma kopyalayın. Uygulamayı kapatıp yeni Setup dosyasını çalıştırın. Başvuru verileri uygulama dosyalarından ayrı bir Bewerbungsordner içinde tutulur. Güncellemeden sonra aynı veri klasörünün açıldığını ve profilinizin göründüğünü kontrol edin.

Bir hata olursa ekrandaki tam mesajı, uygulama sürümünü ve hatayı hangi işlemde aldığınızı paylaşın. Kişisel başvuru verilerini veya şifreleri herkese açık GitHub sorunlarına eklemeyin.

---

## Kurzanleitung auf Deutsch

Laden Sie unter [GitHub Releases](https://github.com/mustafa-oezdemir/bewerbung-studio/releases/latest) aus **Assets** entweder `...-Setup.exe` (Installation) oder `...-Portable.exe` (ohne Installation) herunter. Schließen Sie vor Installation und Update alle BewerbungsManager-Fenster. Wählen Sie beim ersten Start Ihren Bewerbungsordner oder öffnen Sie mit **Workspace-Datei auswählen …** einen vorhandenen Datenbestand. Den aktuellen Speicherort finden Sie unter **Einstellungen → Speicherort**. Erstellen Sie vor einem Update eine Sicherung und prüfen Sie danach, ob derselbe Datenbestand geöffnet wurde.
