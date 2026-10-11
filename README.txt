JurnalSpace
===========
Isi folder (semua harus berada di folder yang SAMA):
  index.html       struktur halaman
  style.css        tampilan
  app.js           mesin pencari (pra-proses, stemming Sastrawi, TF-IDF, VSM, filter kategori)
  data.csv         dataset (4.986 dokumen)
  kata-dasar.txt   kamus kata dasar Sastrawi (29.932 kata) - WAJIB ada agar stemming berjalan

Jalankan lewat server lokal (fetch() tidak jalan jika dibuka via file://):
  python -m http.server 8000     lalu buka http://localhost:8000
  atau ekstensi "Live Server" di VS Code.

Cek stemming: buka "Detail Komputasi" setelah mencari.
  - "Status Indeks" harus menampilkan "Kamus 29.932 kata"
  - Langkah 5 (Stemming) menandai kata yang berubah, mis. "pendekatan -> dekat"
  - Jika muncul "Kamus belum termuat", lihat Log Sistem untuk penyebabnya.
Setelah mengganti file, tekan Ctrl+F5 agar browser tidak memakai cache lama.

Pintasan: tekan "/" untuk fokus ke kolom pencarian.
