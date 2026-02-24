import { MapPin, Phone, Clock, MessageCircle, ExternalLink, Info } from "lucide-react";
import { useT } from "@/hooks/useT";

interface ProfilePageProps {
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  companyWorkHours?: string;
}

export function ProfilePage({ companyName, companyPhone, companyAddress, companyWorkHours }: ProfilePageProps) {
  const t = useT();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <Info className="w-5 h-5 text-brand-600" />
          <span className="text-sm font-semibold text-gray-800">{t("Biz haqimizda")}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
        {/* Company card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-xl">EZ</span>
            </div>
            <h2 className="text-xl font-bold text-white">{companyName}</h2>
            <p className="text-sm text-white/60 mt-1">{t("Mebel do'koni")}</p>
          </div>

          <div className="p-4 space-y-3">
            {companyPhone && (
              <a
                href={`tel:${companyPhone}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{t("Telefon")}</p>
                  <p className="text-sm font-medium text-gray-800">{companyPhone}</p>
                </div>
              </a>
            )}

            {companyAddress && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{t("Manzil")}</p>
                  <p className="text-sm font-medium text-gray-800">{companyAddress}</p>
                </div>
              </div>
            )}

            {companyWorkHours && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{t("Ish vaqti")}</p>
                  <p className="text-sm font-medium text-gray-800">{companyWorkHours}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("Xizmatlarimiz")}</h3>
          <div className="space-y-3">
            {[
              { title: t("Mebel ishlab chiqarish"), desc: t("Buyurtma asosida sifatli mebel") },
              { title: t("Bepul yetkazib berish"), desc: t("Shahar bo'ylab bepul yetkazamiz") },
              { title: t("O'rnatish xizmati"), desc: t("Professional o'rnatish xizmati") },
              { title: t("Kafolat"), desc: t("1 yillik kafolat beramiz") },
              { title: t("Nasiya"), desc: t("12 oygacha bo'lib to'lash imkoniyati") },
            ].map((service, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{service.title}</p>
                  <p className="text-xs text-gray-400">{service.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact buttons */}
        <div className="space-y-2">
          {companyPhone && (
            <a
              href={`tel:${companyPhone}`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold"
            >
              <Phone className="w-4 h-4" />
              {t("Qo'ng'iroq qilish")}
            </a>
          )}
          {companyPhone && (
            <a
              href={`https://t.me/${companyPhone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#0088cc] text-white rounded-xl text-sm font-semibold"
            >
              <MessageCircle className="w-4 h-4" />
              {t("Telegram orqali yozish")}
            </a>
          )}
        </div>

        {/* App info */}
        <p className="text-center text-[10px] text-gray-300 mt-8">
          {companyName} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
