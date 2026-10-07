import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Users, Search } from 'lucide-react';
import { LMSReport } from '../types';

export const LMSReportsView: React.FC = () => {
  const [reports, setReports] = useState<LMSReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<LMSReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/lms/reports');
      const data = await res.json();
      setReports(data || []);
      if (data && data.length > 0) {
        setSelectedReport(data[0]);
      }
    } catch (err) {
      console.error('Error fetching LMS reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportCSV = (report: LMSReport) => {
    let csv = 'Hang,Hoc Vien,Diem So,So Cau Dung,Tong Cau,Thoi Gian Trung Binh (ms)\n';
    report.detailedPlayerResults.forEach((p, idx) => {
      csv += `${idx + 1},"${p.nickname}",${p.score},${p.correctAnswersCount},${p.totalQuestions},${p.averageResponseTimeMs}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LMS_Bao_Cao_${report.roomPin}_${report.quizTitle.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = selectedReport?.detailedPlayerResults.filter((p) =>
    p.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-[#004D2C] text-[#FFCC00]">
              Sổ Điểm & Báo Cáo LMS
            </span>
            <span className="text-xs text-gray-500 font-semibold">Tích hợp đào tạo BIDV</span>
          </div>
          <h1 className="text-2xl font-black text-[#004D2C]">
            Lịch Sử Phiên Học & Kết Quả Học Viên
          </h1>
        </div>

        {selectedReport && (
          <button
            onClick={() => handleExportCSV(selectedReport)}
            className="flex items-center gap-2 bg-[#008049] hover:bg-[#006037] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#FFCC00]" />
            <span>Xuất Báo Cáo Excel (CSV)</span>
          </button>
        )}
      </div>

      {reports.length === 0 && !loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-gray-700 text-base">Chưa có phiên chơi nào được lưu vào LMS</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Sau khi hoàn thành một buổi học trực tiếp (Live Host), hãy bấm "Lưu vào LMS" trên bục vinh quang Podium để đồng bộ.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Sessions List */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">
              CÁC PHIÊN ĐÃ LƯU ({reports.length})
            </h3>
            {reports.map((rep) => {
              const isSelected = selectedReport?.id === rep.id;
              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#008049] bg-emerald-50/70 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#008049]">MÃ PIN: {rep.roomPin}</span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {new Date(rep.completedAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{rep.quizTitle}</h4>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {rep.totalPlayers} học viên
                    </span>
                    <span className="font-semibold text-emerald-800">
                      Điểm TB: {rep.averageScore.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Drill-down */}
          {selectedReport && (
            <div className="lg:col-span-2 space-y-6">
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase block">TỔNG HỌC VIÊN</span>
                  <span className="text-2xl font-black text-[#004D2C] mt-1 block">
                    {selectedReport.totalPlayers}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase block">ĐIỂM TRUNG BÌNH</span>
                  <span className="text-2xl font-black text-[#008049] mt-1 block">
                    {selectedReport.averageScore.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase block">TOP 1</span>
                  <span className="text-base font-black text-[#004D2C] mt-1 truncate block">
                    {selectedReport.topPlayers[0]?.nickname || '---'}
                  </span>
                </div>
              </div>

              {/* Question Accuracy Analytics */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <h4 className="text-xs font-black uppercase text-gray-600 tracking-wider mb-4">
                  TỶ LỆ ĐÚNG THEO TỪNG CÂU HỎI
                </h4>
                <div className="space-y-3">
                  {selectedReport.questionStats.map((qs) => (
                    <div key={qs.questionIndex} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-800 line-clamp-1">
                          Câu {qs.questionIndex}: {qs.title}
                        </span>
                        <span className="font-black text-[#008049] shrink-0 ml-2">
                          {qs.accuracyPercent}% ({qs.correctCount}/{qs.totalAnswers})
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            qs.accuracyPercent >= 70
                              ? 'bg-[#008049]'
                              : qs.accuracyPercent >= 40
                              ? 'bg-[#FFCC00]'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${qs.accuracyPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Students Score Table */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h4 className="text-xs font-black uppercase text-gray-600 tracking-wider">
                    BẢNG ĐIỂM CHI TIẾT HỌC VIÊN
                  </h4>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-[#008049]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase">
                        <th className="py-2.5 px-3">Hạng</th>
                        <th className="py-2.5 px-3">Học viên</th>
                        <th className="py-2.5 px-3">Điểm số</th>
                        <th className="py-2.5 px-3">Số câu đúng</th>
                        <th className="py-2.5 px-3">TG Phản Hồi TB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents?.map((student, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-bold text-gray-700">#{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-gray-900">{student.nickname}</td>
                          <td className="py-2.5 px-3 font-black text-[#008049]">
                            {student.score.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">
                            {student.correctAnswersCount} / {student.totalQuestions}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500">
                            {(student.averageResponseTimeMs / 1000).toFixed(1)}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
