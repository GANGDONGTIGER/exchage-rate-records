// ---------------------------------
// 1. 초기 설정 및 DOM 요소 가져오기
// ---------------------------------
const form = document.getElementById('exchange-form');
const recordListBody = document.getElementById('record-list-body');
const recordRowTemplate = document.getElementById('record-row-template');
const loadingOverlay = document.getElementById('loading-overlay');
const targetCurrencySelect = document.getElementById('target-currency');
const transactionTypeSelect = document.getElementById('transaction-type');
const transactionDateInput = document.getElementById('transaction-date');
const foreignAmountInput = document.getElementById('foreign-amount');
const exchangeRateInput = document.getElementById('exchange-rate');
const baseAmountInput = document.getElementById('base-amount');
const linkedBuyIdWrapper = document.getElementById('linked-buy-id-wrapper');
const linkedBuyIdSelect = document.getElementById('linked-buy-id');
const totalPlElement = document.getElementById('total-pl');
const currentHoldingsElement = document.getElementById('current-holdings');
const avgBuyPriceElement = document.getElementById('avg-buy-price');
const currentMonthPlElement = document.getElementById('current-month-pl');
const monthlyPlSelect = document.getElementById('monthly-pl-select');
const monthlyPlResult = document.getElementById('monthly-pl-result');
const dailyLimitSwFill = document.getElementById('daily-limit-sw-fill');
const dailyLimitSwText = document.getElementById('daily-limit-sw-text');
const dailyLimitHrFill = document.getElementById('daily-limit-hr-fill');
const dailyLimitHrText = document.getElementById('daily-limit-hr-text');
const monthlyLimitSwFill = document.getElementById('monthly-limit-sw-fill');
const monthlyLimitSwText = document.getElementById('monthly-limit-sw-text');
const monthlyLimitHrFill = document.getElementById('monthly-limit-hr-fill');
const monthlyLimitHrText = document.getElementById('monthly-limit-hr-text');
const toggleCalculatorBtn = document.getElementById('toggle-calculator-btn');
const calculatorContent = document.getElementById('calculator-content');
const calcTraderRadios = document.querySelectorAll('input[name="calc-trader"]');
const calcBuySelect = document.getElementById('calc-buy-select');
const calcResultsContainer = document.getElementById('calc-results-container');
const profitChartContainer = document.getElementById('profit-chart-container');
const lossChartContainer = document.getElementById('loss-chart-container');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfoSpan = document.getElementById('page-info');

// ---------------------------------
// 2. 전역 데이터 변수 및 상태
// ---------------------------------
let records = [];
let allRecordsForFilter = [];
let monthlyPlData = {};
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw0skZAuWgTMGOuTehPepXfIbUihjagRDQfTVaFHVjWbVC2JqRkTNNxGVtE9DMuaHi6cA/exec";
let editMode = { active: false, recordId: null };
let currentPage = 1;
let totalRecords = 0;
const RECORDS_PER_PAGE = 50;
let isLoading = false;
let currentTraderFilter = 'all'; // [추가] 현재 선택된 거래자 필터 ('all', 'SW', 'HR')


// ---------------------------------
// 3. 헬퍼(Helper) 함수
// ---------------------------------
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function formatNumber(value) {
    const stringValue = value.toString();
    const parts = stringValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}
function unformatNumber(stringValue) {
    return stringValue.toString().replace(/,/g, '');
}

// ---------------------------------
// 4. 핵심 기능 함수
// ---------------------------------
function renderAll(response) {
    records = response.records;
    totalRecords = response.totalRecords;
    allRecordsForFilter = response.allRecordsForFilter;
    monthlyPlData = response.analytics.monthlyPL;
    updateDashboard(response.analytics);
    populateMonthSelector(response.analytics.monthlyPL);
    renderRecords(new Set(response.analytics.soldBuyIds));
    updateAvailableBuyOptions();
    updateCalculatorBuyOptions();
    renderPagination();
}

function updateDashboard({ totalPL, currentMonthPL, holdings, avgBuyPrices, limitUsage }) {
    totalPlElement.textContent = `${Math.round(totalPL).toLocaleString()} 원`;
    totalPlElement.className = `dashboard-value ${totalPL >= 0 ? 'profit' : 'loss'}`;
    currentMonthPlElement.textContent = `${Math.round(currentMonthPL).toLocaleString()} 원`;
    currentMonthPlElement.className = `dashboard-value ${currentMonthPL >= 0 ? 'profit' : 'loss'}`;
    const holdingsHTML = Object.entries(holdings).map(([currency, amount]) => `<p>${currency}: ${formatNumber(Number(amount).toFixed(2))}</p>`).join('') || '<p>-</p>';
    currentHoldingsElement.innerHTML = holdingsHTML;
    const avgPricesHTML = Object.entries(avgBuyPrices).map(([currency, price]) => `<p>${currency}: ${formatNumber(Number(price).toFixed(2))} 원</p>`).join('') || '<p>-</p>';
    avgBuyPriceElement.innerHTML = avgPricesHTML;
    const DAILY_MAX = 10000000;
    const MONTHLY_MAX = 100000000;
    const dailyRemainingSw = DAILY_MAX - limitUsage.daily.SW;
    dailyLimitSwFill.style.width = `${Math.min((limitUsage.daily.SW / DAILY_MAX) * 100, 100)}%`;
    dailyLimitSwText.textContent = `잔여: ${dailyRemainingSw.toLocaleString()}원`;
    const dailyRemainingHr = DAILY_MAX - limitUsage.daily.HR;
    dailyLimitHrFill.style.width = `${Math.min((limitUsage.daily.HR / DAILY_MAX) * 100, 100)}%`;
    dailyLimitHrText.textContent = `잔여: ${dailyRemainingHr.toLocaleString()}원`;
    const monthlyRemainingSw = MONTHLY_MAX - limitUsage.monthly.SW;
    monthlyLimitSwFill.style.width = `${Math.min((limitUsage.monthly.SW / MONTHLY_MAX) * 100, 100)}%`;
    monthlyLimitSwText.textContent = `잔여: ${monthlyRemainingSw.toLocaleString()}원`;
    const monthlyRemainingHr = MONTHLY_MAX - limitUsage.monthly.HR;
    monthlyLimitHrFill.style.width = `${Math.min((limitUsage.monthly.HR / MONTHLY_MAX) * 100, 100)}%`;
    monthlyLimitHrText.textContent = `잔여: ${monthlyRemainingHr.toLocaleString()}원`;
}

function populateMonthSelector(monthlyData) {
    monthlyPlSelect.innerHTML = '';
    const sortedMonths = Object.keys(monthlyData).sort().reverse();
    const today = new Date();
    let prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const defaultSelectedMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    if (sortedMonths.length === 0) {
        monthlyPlSelect.innerHTML = '<option>기록 없음</option>';
        monthlyPlResult.textContent = '-';
        return;
    }
    sortedMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month.replace('-', '.');
        monthlyPlSelect.appendChild(option);
    });
    if (sortedMonths.includes(defaultSelectedMonth)) {
        monthlyPlSelect.value = defaultSelectedMonth;
    } else {
        monthlyPlSelect.value = sortedMonths[0] || '';
    }
    displaySelectedMonthlyPL();
}

function displaySelectedMonthlyPL() {
    const selectedMonth = monthlyPlSelect.value;
    const profit = monthlyPlData[selectedMonth] || 0;
    monthlyPlResult.textContent = `${Math.round(profit).toLocaleString()} 원`;
    monthlyPlResult.className = profit >= 0 ? 'profit' : 'loss';
}

// ... 파일 상단 및 다른 함수들은 이전과 동일 ...

function renderRecords(soldBuyIds = new Set()) {
    recordListBody.innerHTML = '';

    const recordsToRender = (currentTraderFilter === 'all')
        ? records
        : records.filter(r => r.trader === currentTraderFilter);

    recordsToRender.forEach(record => {
        // 1. 템플릿에서 모든 요소(<tr> 2개)를 복제합니다.
        const templateContent = recordRowTemplate.content.cloneNode(true);
        const mainRow = templateContent.querySelector('.main-record-row');
        const detailsRow = templateContent.querySelector('.linked-buy-row');
        
        // --- 2. 메인 행(mainRow) 데이터 채우기 (이전과 동일) ---
        if ((record.type === 'sell' && record.linked_buy_id) || (record.type === 'buy' && soldBuyIds.has(record.id.toString()))) {
            mainRow.classList.add('record-completed');
        }
        const typeCell = mainRow.querySelector('.record-type');
        if (record.type === 'buy') {
            typeCell.textContent = '매수'; typeCell.style.color = '#3498db';
        } else {
            typeCell.textContent = '매도'; typeCell.style.color = '#e74c3c';
        }
        mainRow.querySelector('.record-trader').textContent = record.trader || '-';
        mainRow.querySelector('.record-date').textContent = record.timestamp.substring(0, 10);
        mainRow.querySelector('.record-currency').textContent = record.target_currency;
        mainRow.querySelector('.record-foreign-amount').textContent = formatNumber(Number(record.foreign_amount).toFixed(2));
        mainRow.querySelector('.record-rate').textContent = formatNumber(Number(record.exchange_rate).toFixed(2));
        mainRow.querySelector('.record-base-amount').textContent = Math.round(record.base_amount).toLocaleString();
        mainRow.querySelector('.edit-btn').dataset.id = record.id;
        mainRow.querySelector('.delete-btn').dataset.id = record.id;
        
        // --- 3. '판매' 기록일 경우, 상세 정보 행을 채우고 보여주기 ---
        const plCell = mainRow.querySelector('.record-pl');
        if (record.type === 'sell' && record.linked_buy_id) {
            const originalBuy = allRecordsForFilter.find(r => r.id.toString() === record.linked_buy_id.toString());
            if (originalBuy) {
                const profit = record.base_amount - originalBuy.base_amount;
                plCell.textContent = Math.round(profit).toLocaleString();
                plCell.classList.add(profit >= 0 ? 'profit' : 'loss');

                const detailsCell = detailsRow.querySelector('.linked-buy-details');
                // ... renderRecords 함수 내부 ...
                detailsCell.textContent = 
                    `매수 정보: ${originalBuy.timestamp.substring(0, 10)} / ${originalBuy.trader} / ${originalBuy.target_currency} ${formatNumber(Number(originalBuy.foreign_amount).toFixed(2))} (환율: ${formatNumber(Number(originalBuy.exchange_rate).toFixed(2))})`;
                // ...
                detailsRow.classList.remove('hidden');
            }
        } else {
            // --- 4. '구매' 기록일 경우, 불필요한 상세 정보 행을 템플릿에서 제거 ---
            detailsRow.remove();
        }
        
        // --- 5. 최종적으로 준비된 내용(행 1개 또는 2개)을 테이블에 한번에 추가 ---
        recordListBody.appendChild(templateContent);
    });
}

// ... 나머지 함수 및 이벤트 리스너들은 이전과 동일 ...
function updateAvailableBuyOptions() {
    const soldBuyIds = new Set(allRecordsForFilter.filter(r => r.type === 'sell' && r.linked_buy_id).map(r => r.linked_buy_id.toString()));
    const selectedTrader = document.querySelector('input[name="trader"]:checked')?.value;
    let availableBuyRecords = [];
    if (selectedTrader) {
        availableBuyRecords = allRecordsForFilter.filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString()) && r.trader === selectedTrader);
    }
    linkedBuyIdSelect.innerHTML = '<option value="">-- 원본 구매 기록 선택 --</option>';
    availableBuyRecords.forEach(r => {
        const option = document.createElement('option');
        option.value = r.id;
        const displayDate = r.timestamp.substring(0, 10);
        option.textContent = `${displayDate} / ${r.target_currency} ${r.foreign_amount} (환율: ${r.exchange_rate})`;
        linkedBuyIdSelect.appendChild(option);
    });
}

function calculateBaseAmount() {
    const foreignAmount = parseFloat(unformatNumber(foreignAmountInput.value));
    const exchangeRate = parseFloat(unformatNumber(exchangeRateInput.value));
    const selectedCurrency = targetCurrencySelect.value;
    if (!isNaN(foreignAmount) && !isNaN(exchangeRate)) {
        let calculatedAmount = foreignAmount * exchangeRate;
        if (selectedCurrency === 'JPY') {
            calculatedAmount /= 100;
        }
        baseAmountInput.value = formatNumber(Math.round(calculatedAmount));
    } else {
        baseAmountInput.value = '';
    }
}

function handleTransactionTypeChange() {
    if (transactionTypeSelect.value === 'sell') {
        linkedBuyIdWrapper.classList.remove('hidden');
        updateAvailableBuyOptions();
    } else {
        linkedBuyIdWrapper.classList.add('hidden');
    }
}

function resetFormToCreateMode() {
    form.reset();
    baseAmountInput.value = '';
    transactionDateInput.value = getTodayString();
    editMode = { active: false, recordId: null };
    form.querySelector('button[type="submit"]').textContent = '저장';
    handleTransactionTypeChange();
}

function updateCalculatorBuyOptions() {
    const soldBuyIds = new Set(allRecordsForFilter.filter(r => r.type === 'sell' && r.linked_buy_id).map(r => r.linked_buy_id.toString()));
    const selectedTrader = document.querySelector('input[name="calc-trader"]:checked')?.value;
    let availableBuyRecords = [];
    if (selectedTrader) {
        availableBuyRecords = allRecordsForFilter.filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString()) && r.trader === selectedTrader);
    }
    calcBuySelect.innerHTML = '';
    if (!selectedTrader) {
        calcBuySelect.innerHTML = '<option value="">-- 거래자를 먼저 선택하세요 --</option>';
        renderCalculatorCharts(null);
        return;
    }
    if (availableBuyRecords.length === 0) {
        calcBuySelect.innerHTML = '<option value="">-- 분석 가능한 매수 건 없음 --</option>';
        renderCalculatorCharts(null);
        return;
    }
    calcBuySelect.innerHTML = '<option value="">-- 분석할 매수 건 선택 --</option>';
    availableBuyRecords.forEach(r => {
        const option = document.createElement('option');
        option.value = r.id;
        const displayDate = r.timestamp.substring(0, 10);
        option.textContent = `${displayDate} / ${r.target_currency} ${r.foreign_amount} (환율: ${r.exchange_rate})`;
        calcBuySelect.appendChild(option);
    });
}

function renderCalculatorCharts(buyRecordId) {
    if (!buyRecordId) {
        calcResultsContainer.classList.add('hidden');
        return;
    }
    const buyRecord = allRecordsForFilter.find(r => r.id.toString() === buyRecordId);
    if (!buyRecord) return;
    calcResultsContainer.classList.remove('hidden');
    profitChartContainer.innerHTML = '';
    lossChartContainer.innerHTML = '';
    const baseRate = Number(buyRecord.exchange_rate) || 0;
    const foreignAmount = Number(buyRecord.foreign_amount) || 0;
    if (baseRate === 0 || foreignAmount === 0) return;
    const scenarios = [];
    for (let i = 1; i <= 5; i++) {
        scenarios.push(Math.round(baseRate) + i);
        scenarios.push(Math.round(baseRate) - i);
    }
    let maxAbsPL = 0;
    const chartData = scenarios.map(sellRate => {
        let originalRateForCalc = baseRate;
        let currentSellRate = sellRate;
        if (buyRecord.target_currency === 'JPY') {
            originalRateForCalc /= 100;
            currentSellRate /= 100;
        }
        const cost = foreignAmount * originalRateForCalc;
        const revenue = foreignAmount * currentSellRate;
        const profit = revenue - cost;
        if (Math.abs(profit) > maxAbsPL) {
            maxAbsPL = Math.abs(profit);
        }
        return { rate: sellRate, pl: profit };
    });
    chartData.sort((a, b) => a.rate - b.rate).forEach(data => {
        const row = document.createElement('div');
        row.className = 'h-bar-row';
        const label = document.createElement('span');
        label.className = 'h-bar-label';
        label.textContent = `${data.rate.toLocaleString()}원`;
        const barContainer = document.createElement('div');
        barContainer.className = 'h-bar-container';
        const barFill = document.createElement('div');
        barFill.className = 'h-bar-fill';
        const ratio = maxAbsPL > 0 ? Math.abs(data.pl) / maxAbsPL : 0;
        const barWidth = Math.pow(ratio, 2) * 100;
        barFill.style.width = `${barWidth}%`;
        barFill.textContent = `${data.pl >= 0 ? '+' : ''}${Math.round(data.pl).toLocaleString()}`;
        barContainer.appendChild(barFill);
        row.appendChild(label);
        row.appendChild(barContainer);
        if (data.pl >= 0) {
            barFill.classList.add('profit');
            profitChartContainer.appendChild(row);
        } else {
            barFill.classList.add('loss');
            lossChartContainer.appendChild(row);
        }
    });
    Array.from(profitChartContainer.children).sort((a,b) => a.querySelector('.h-bar-label').textContent.localeCompare(b.querySelector('.h-bar-label').textContent, undefined, {numeric: true})).forEach(node => profitChartContainer.appendChild(node));
    Array.from(lossChartContainer.children).sort((a,b) => b.querySelector('.h-bar-label').textContent.localeCompare(a.querySelector('.h-bar-label').textContent, undefined, {numeric: true})).forEach(node => lossChartContainer.appendChild(node));
}

function renderPagination() {
    const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);
    pageInfoSpan.textContent = `Page ${currentPage} / ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// ---------------------------------
// 5. 이벤트 리스너
// ---------------------------------
transactionTypeSelect.addEventListener('change', handleTransactionTypeChange);
monthlyPlSelect.addEventListener('change', displaySelectedMonthlyPL);
toggleCalculatorBtn.addEventListener('click', function() {
    const isExpanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', !isExpanded);
    calculatorContent.classList.toggle('hidden');
    this.querySelector('span').textContent = isExpanded ? '▼' : '▲';
    this.childNodes[0].nodeValue = isExpanded ? '환율 계산기 열기 ' : '환율 계산기 닫기 ';
});
calcTraderRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        updateCalculatorBuyOptions();
        renderCalculatorCharts(null);
    });
});
calcBuySelect.addEventListener('change', function() {
    renderCalculatorCharts(this.value);
});
linkedBuyIdSelect.addEventListener('change', function() {
    const selectedBuyId = this.value;
    if (!selectedBuyId) {
        foreignAmountInput.value = '';
        baseAmountInput.value = '';
        return;
    }
    const selectedBuyRecord = allRecordsForFilter.find(r => r.id.toString() === selectedBuyId);
    if (selectedBuyRecord) {
        foreignAmountInput.value = formatNumber(selectedBuyRecord.foreign_amount);
        calculateBaseAmount();
    }
});
document.querySelectorAll('input[name="trader"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (transactionTypeSelect.value === 'sell') {
            updateAvailableBuyOptions();
        }
    });
});
[foreignAmountInput, exchangeRateInput, baseAmountInput].forEach(input => {
    input.addEventListener('input', (e) => {
        const rawValue = unformatNumber(e.target.value);
        if (isNaN(rawValue) && rawValue !== '') {
            e.target.value = e.target.value.slice(0, -1);
            return;
        }
        e.target.value = formatNumber(rawValue);
        if (e.target.id === 'foreign-amount' || e.target.id === 'exchange-rate') {
            calculateBaseAmount();
        }
    });
});
recordListBody.addEventListener('click', function(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const recordId = button.dataset.id;
    if (!recordId) return;
    const recordToHandle = allRecordsForFilter.find(r => r.id.toString() === recordId);
    if (!recordToHandle) return alert('수정할 기록을 찾지 못했습니다.');
    if (button.classList.contains('edit-btn')) {
        if (recordToHandle.type === 'sell') {
            alert("안정적인 데이터 관리를 위해 '판매' 기록은 수정할 수 없습니다.");
            return;
        }
        if (recordToHandle.trader) {
            document.querySelector(`input[name="trader"][value="${recordToHandle.trader}"]`).checked = true;
        }
        targetCurrencySelect.value = recordToHandle.target_currency;
        transactionTypeSelect.value = recordToHandle.type;
        transactionDateInput.value = recordToHandle.timestamp.substring(0, 10);
        foreignAmountInput.value = formatNumber(recordToHandle.foreign_amount);
        exchangeRateInput.value = formatNumber(recordToHandle.exchange_rate);
        baseAmountInput.value = formatNumber(recordToHandle.base_amount);
        handleTransactionTypeChange();
        if (recordToHandle.type === 'sell' && recordToHandle.linked_buy_id) {
            setTimeout(() => { linkedBuyIdSelect.value = recordToHandle.linked_buy_id; }, 100);
        }
        editMode = { active: true, recordId: recordId };
        form.querySelector('button[type="submit"]').textContent = '수정 완료';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (button.classList.contains('delete-btn')) {
        if (!confirm("정말로 이 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
        loadingOverlay.classList.remove('hidden');
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: recordId }),
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                fetchRecords(currentPage);
            } else { throw new Error(result.message); }
        })
        .catch(error => alert(`삭제에 실패했습니다: ${error.message}`))
        .finally(() => { loadingOverlay.classList.add('hidden'); });
    }
});
form.addEventListener('submit', function(event) {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const selectedTrader = document.querySelector('input[name="trader"]:checked');
    if (!selectedTrader) {
        alert('거래자를 선택해주세요.');
        return;
    }
    submitButton.disabled = true;
    submitButton.textContent = '저장 중...';
    loadingOverlay.classList.remove('hidden');
    const action = editMode.active ? 'update' : 'create';
    const recordId = editMode.active ? editMode.recordId : 't' + Date.now();
    let timestamp;
    if (action === 'update') {
        const dateParts = transactionDateInput.value.split('-');
        const now = new Date();
        const updatedTimestamp = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), now.getHours(), now.getMinutes(), now.getSeconds());
        timestamp = updatedTimestamp.toISOString();
    } else {
        timestamp = new Date().toISOString();
    }
    const recordData = {
        id: recordId,
        trader: selectedTrader.value,
        type: transactionTypeSelect.value,
        timestamp: timestamp,
        target_currency: targetCurrencySelect.value,
        foreign_amount: parseFloat(unformatNumber(foreignAmountInput.value)),
        exchange_rate: parseFloat(unformatNumber(exchangeRateInput.value)),
        base_amount: parseInt(unformatNumber(baseAmountInput.value), 10),
        linked_buy_id: transactionTypeSelect.value === 'sell' ? linkedBuyIdSelect.value : null,
    };
    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, data: recordData }),
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            fetchRecords(1);
            resetFormToCreateMode();
        } else { throw new Error(result.message || '알 수 없는 에러 발생'); }
    })
    .catch(error => alert(`작업에 실패했습니다: ${error.message}`))
    .finally(() => {
        submitButton.disabled = false;
        if (!editMode.active) {
            submitButton.textContent = '저장';
        } else {
            submitButton.textContent = '수정 완료';
        }
        loadingOverlay.classList.add('hidden');
    });
});
prevPageBtn.addEventListener('click', () => {
    if (!isLoading && currentPage > 1) {
        fetchRecords(currentPage - 1);
    }
});
nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);
    if (!isLoading && currentPage < totalPages) {
        fetchRecords(currentPage + 1);
    }
});
// [추가] 거래 히스토리 필터 버튼 이벤트 리스너
document.querySelector('.filter-controls').addEventListener('click', (event) => {
    if (event.target.classList.contains('filter-btn')) {
        const selectedTrader = event.target.dataset.trader;

        // 1. 전역 필터 상태 업데이트
        currentTraderFilter = selectedTrader;

        // 2. 모든 버튼에서 'active' 클래스 제거 후, 클릭된 버튼에만 추가
        document.querySelectorAll('.filter-controls .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // 3. 필터링된 데이터로 테이블 다시 그리기
        // renderRecords는 현재 페이지 데이터(records)를 사용하므로,
        // 전체 분석 데이터에서 soldBuyIds만 다시 가져와서 전달합니다.
        // [수정] soldBuyIds를 allRecordsForFilter에서 직접 계산합니다.
        const soldBuyIds = new Set(
            allRecordsForFilter
                .filter(r => r.type === 'sell' && r.linked_buy_id)
                .map(r => r.linked_buy_id.toString())
        );
        renderRecords(soldBuyIds);
    }
});

// ---------------------------------
// 6. 초기 실행
// ---------------------------------
function fetchRecords(page = 1) {
    if (isLoading) return;
    isLoading = true;
    loadingOverlay.classList.remove('hidden');

    fetch(`${SCRIPT_URL}?page=${page}&limit=${RECORDS_PER_PAGE}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(res => {
            // 백엔드 응답 구조 확인
            if (!res || typeof res.analytics === 'undefined' || !Array.isArray(res.records)) {
                throw new TypeError("서버로부터 받은 데이터 형식이 올바르지 않습니다.");
            }
            
            records = res.records;
            totalRecords = res.totalRecords;
            allRecordsForFilter = res.allRecordsForFilter;
            
            currentPage = page;
            renderAll(res);
        })
        .catch(error => {
            console.error('데이터를 불러오는 중 에러 발생:', error);
            alert('데이터를 불러오는 데 실패했습니다. Apps Script를 다시 배포하거나 Console을 확인해주세요.');
        })
        .finally(() => {
            loadingOverlay.classList.add('hidden');
            isLoading = false;
        });
}

document.addEventListener('DOMContentLoaded', () => {
    transactionDateInput.value = getTodayString();
    if (SCRIPT_URL.includes("여기에_본인의_웹_앱_URL을_붙여넣어주세요")) {
        alert("main.js 파일의 SCRIPT_URL 변수에 본인의 웹 앱 URL을 먼저 입력해주세요!");
        return;
    }
    fetchRecords(1);
});