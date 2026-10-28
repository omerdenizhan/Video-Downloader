@chcp 65001 >nul
@echo off
cd /d %~dp0

:: CMD penceresini baştan 70 karakter genişliğe ve 30 satır yüksekliğe sabitle
mode con: cols=70 lines=30

:: Renk Değişkenleri Tanımı
set "YESIL=[92m"
set "SARI=[93m"
set "RENK_SIFIRLA=[0m"

:: ==========================================
:: YÖNETİCİ YETKİ KONTROLÜ
:: ==========================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    cls
    echo.
    echo %YESIL% =================================================================%RENK_SIFIRLA%
    echo %YESIL%                             U Y A R I                            %RENK_SIFIRLA%
    echo %YESIL% =================================================================%RENK_SIFIRLA%
    echo.
    echo  %SARI%Bu scripti çalıştırmak için dosyayı sağ tıklayıp "Yönetici olarak%RENK_SIFIRLA%
    echo  %SARI%çalıştır" seçeneğini kullanmalısınız!%RENK_SIFIRLA%
    echo.
    echo %YESIL% =================================================================%RENK_SIFIRLA%
    echo.
    echo  Program 5 saniye içinde kapatılacak...
    
    timeout /t 5 > nul
    exit /b
)

:: Menü
:menu
cls
:: Çerçeve ve Başlık Parlak Sarı (93m)
echo [93m======================================================================[0m
echo [93m                       SCRİPT ÇALIŞTIRMA MENÜSÜ                       [0m
echo [93m======================================================================[0m
echo.

:: Seçenekler
echo [96m [1] Projeyi Çalıştır (npm start)[0m
echo [96m [2] Projeye Node Yükle[0m
echo [96m [3] Projedeki Node Kurulumunu Kaldır[0m
echo [96m [4] Projenin Veritabanını Sil[0m
echo [96m [5] Projenin Geçici İndirilenler Klasörünü Sil[0m
echo [91m [6] Çıkış Yap[0m
echo.

:: Yazıyı renkli olarak echo ile yazdırıp, choice komutunu arka planda çalıştırıyoruz
<nul set /p=%YESIL% Lütfen bir işlem seçin (1-6): %RENK_SIFIRLA%
choice /c 123456 /n >nul

if errorlevel 6 goto cikis
if errorlevel 5 goto islem_5
if errorlevel 4 goto islem_4
if errorlevel 3 goto islem_3
if errorlevel 2 goto islem_2
if errorlevel 1 goto islem_1

:: Menü Seçenek 1
:islem_1
cls
echo [93m======================================================================[0m
echo [93m                       SCRİPT ÇALIŞTIRMA MENÜSÜ                       [0m
echo [93m======================================================================[0m
echo.
echo.
set "BULUNDU1=0"
if exist "%~dp0node_modules\" set "BULUNDU1=1"
if "%BULUNDU1%"=="0" (
    echo [91m Projede Node kurulumu yapılmamış![0m
    echo.
    timeout /t 2 >nul
    goto menu
)
echo Proje çalıştırılıyor...
start "" /min cmd /c "timeout /t 3 >nul & start http://localhost:3000"
npm start

:: Menü Seçenek 2
:islem_2
cls
echo [93m======================================================================[0m
echo [93m                       SCRİPT ÇALIŞTIRMA MENÜSÜ                       [0m
echo [93m======================================================================[0m
echo.
echo.
echo Projeye Node kurulumu yapılıyor...
call npm install
set "HATA=%errorlevel%"
popd
if not "%HATA%"=="0" (
    echo.
    echo [91m Kurulum esnasında hata oluştu![0m
    echo.
    pause
    goto menu
)
echo.
echo İşlem tamamlandı!
echo.
timeout /t 2 >nul
goto menu

:: Menü Seçenek 3
:islem_3
cls
echo [93m======================================================================[0m
echo [93m                       SCRİPT ÇALIŞTIRMA MENÜSÜ                       [0m
echo [93m======================================================================[0m
echo.
echo.
set "BULUNDU2=0"
if exist "%~dp0node_modules\" set "BULUNDU2=1"
if "%BULUNDU2%"=="0" (
    echo [91m Projede Node kurulumu yapılmamış![0m
    echo.
    timeout /t 2 >nul
    goto menu
)
echo [93m Projedeki Node kurulumu silinecek![0m
echo.
<nul set /p=%YESIL% Emin misiniz? (E/H): %RENK_SIFIRLA%
choice /c EH /n >nul
if errorlevel 2 goto menu
echo.
echo.
echo Projenin Node kurulumu siliniyor...
if exist "%~dp0node_modules\" rd /s /q "%~dp0node_modules"
echo.
echo Silme işlemi tamamlandı!
echo.
timeout /t 2 >nul
goto menu

:: Menü Seçenek 4
:islem_4
cls
echo [93m======================================================================[0m
echo [93m                       SCRİPT ÇALIŞTIRMA MENÜSÜ                       [0m
echo [93m======================================================================[0m
echo.
echo.
if not exist "%~dp0veritabani\database.db" (
    echo [91m Projenin veritabanı dosyası bulunamadı![0m
    echo.
    pause
    goto menu
)
echo [93m Projenin veritabanı dosyası silinecek![0m
echo.
<nul set /p=%YESIL% Emin misiniz? (E/H): %RENK_SIFIRLA%
choice /c EH /n >nul
if errorlevel 2 goto menu
echo.
echo.
echo Projenin veritabanı siliniyor...
del /f /q "%~dp0veritabani\database.db" >nul 2>&1
echo.
echo Silme işlemi tamamlandı!
echo.
timeout /t 2 >nul
goto menu


:: Menü Seçenek 5
:islem_5
cls
echo [93m======================================================================[0m
echo [93m                       SCRİPT ÇALIŞTIRMA MENÜSÜ                       [0m
echo [93m======================================================================[0m
echo.
echo.
echo [93m Projenin geçici indirilenler klasörü silinecek![0m
echo.
<nul set /p=%YESIL% Emin misiniz? (E/H): %RENK_SIFIRLA%
choice /c EH /n >nul
if errorlevel 2 goto menu
echo.
echo.
echo Projenin veritabanı siliniyor...
del /f /q "%~dp0gecici\*" >nul 2>&1
echo.
echo Silme işlemi tamamlandı!
echo.
timeout /t 2 >nul
goto menu

:: Menü Seçenek 6 (Çıkış)
:cikis
cls
echo [93m======================================================================[0m
echo [93m                       SCRİPT ÇALIŞTIRMA MENÜSÜ                       [0m
echo [93m======================================================================[0m
echo.
echo.
echo [91m Program kapatılıyor...[0m
timeout /t 3 >nul
exit
