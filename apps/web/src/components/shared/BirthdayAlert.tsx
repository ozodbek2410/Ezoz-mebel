import { Cake, Phone, X } from "lucide-react";

interface BirthdayCustomer {
  id: number;
  fullName: string;
  phone: string | null;
  birthday: Date | string;
}

interface BirthdayAlertProps {
  customers: BirthdayCustomer[];
  onDismiss: () => void;
}

export function BirthdayAlert({ customers, onDismiss }: BirthdayAlertProps) {
  if (customers.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-5 text-white relative">
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Cake className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Tug'ilgan kun!</h2>
              <p className="text-sm text-white/80">
                Bugun {customers.length} ta mijozning tug'ilgan kuni
              </p>
            </div>
          </div>
        </div>

        {/* Customer list */}
        <div className="px-6 py-4 max-h-[300px] overflow-y-auto">
          <div className="space-y-3">
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 bg-pink-50 rounded-xl"
              >
                <div>
                  <p className="font-semibold text-gray-900">{c.fullName}</p>
                  {c.phone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {c.phone}
                    </p>
                  )}
                </div>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="px-3 py-1.5 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 transition-colors"
                  >
                    Qo'ng'iroq
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onDismiss}
            className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Tushundim
          </button>
        </div>
      </div>
    </div>
  );
}
