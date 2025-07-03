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


// ---------------------------------
// 2. 전역 데이터 변수 및 상태
// ---------------------------------
let records = [];
let monthlyPlData = {};
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw0skZAuWgTMGOuTehPepXfIbUihjagRDQfTVaFHVjWbVC2JqRkTNNxGVtE9DMuaHi6cA/exec"; 
let editMode = { active: false, recordId: null };


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
function calculateAndRenderAll() {
    const analytics = calculateAnalytics(records);
    monthlyPlData = analytics.monthlyPL;
    updateDashboard(analytics);
    populateMonthSelector(analytics.monthlyPL);
    renderRecords(analytics.plMap, analytics.soldBuyIds);
    updateAvailableBuyOptions(analytics.soldBuyIds);
    updateCalculatorBuyOptions(analytics.soldBuyIds);
}

function calculateAnalytics(records) {
    let totalPL = 0;
    let currentMonthPL = 0;
    const monthlyPL = {};
    const plMap = new Map();
    const buyRecordMap = new Map(records.filter(r => r.type === 'buy').map(r => [r.id.toString(), r]));
    const soldBuyIds = new Set(
        records
            .filter(r => r.type === 'sell' && r.linked_buy_id)
            .map(r => r.linked_buy_id.toString())
    );
    
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let dailyLimitStart = new Date(now);
    if (now.getHours() < 9) {
        dailyLimitStart.setDate(dailyLimitStart.getDate() - 1);
    }
    dailyLimitStart.setHours(9, 0, 0, 0);
    let dailyLimitEnd = new Date(dailyLimitStart);
    dailyLimitEnd.setDate(dailyLimitEnd.getDate() + 1);

    let monthlyLimitStart = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0);
    if (now.getDate() === 1 && now.getHours() < 9) {
        monthlyLimitStart.setMonth(monthlyLimitStart.getMonth() - 1);
    }
    let monthlyLimitEnd = new Date(monthlyLimitStart);
    monthlyLimitEnd.setMonth(monthlyLimitEnd.getMonth() + 1);

    const limitUsage = { daily: { SW: 0, HR: 0 }, monthly: { SW: 0, HR: 0 } };

    records.forEach(record => {
        const recordDate = new Date(record.timestamp);

        if (record.type === 'buy' && record.trader) {
            if (recordDate >= dailyLimitStart && recordDate < dailyLimitEnd) {
                limitUsage.daily[record.trader] += record.base_amount;
            }
            if (recordDate >= monthlyLimitStart && recordDate < monthlyLimitEnd) {
                limitUsage.monthly[record.trader] += record.base_amount;
            }
        }
        
        if (record.type === 'sell' && record.linked_buy_id) {
            const originalBuy = buyRecordMap.get(record.linked_buy_id.toString());
            if (originalBuy) {
                const profit = record.base_amount - originalBuy.base_amount;
                totalPL += profit;
                plMap.set(record.id.toString(), profit);
                const sellDate = new Date(record.timestamp);
                const sellYearMonth = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlyPL[sellYearMonth]) { monthlyPL[sellYearMonth] = 0; }
                monthlyPL[sellYearMonth] += profit;
                if (sellYearMonth === currentYearMonth) { currentMonthPL += profit; }
            }
        }
    });

    const holdings = {};
    const buyStats = {};
    records.filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString())).forEach(buyRecord => {
        const currency = buyRecord.target_currency;
        if (!holdings[currency]) {
            holdings[currency] = 0;
            buyStats[currency] = { totalAmount: 0, totalCost: 0 };
        }
        holdings[currency] += buyRecord.foreign_amount;
        buyStats[currency].totalAmount += buyRecord.foreign_amount;
        buyStats[currency].totalCost += buyRecord.base_amount;
    });

    const avgBuyPrices = {};
    for (const currency in buyStats) {
        let avgPrice = buyStats[currency].totalCost / buyStats[currency].totalAmount;
        if (currency === 'JPY') {
            avgPrice = avgPrice * 100;
        }
        avgBuyPrices[currency] = avgPrice;
    }
    
    return { totalPL, currentMonthPL, monthlyPL, plMap, holdings, avgBuyPrices, soldBuyIds, limitUsage };
}

function updateDashboard({ totalPL, currentMonthPL, holdings, avgBuyPrices, limitUsage }) {
    totalPlElement.textContent = `${Math.round(totalPL).toLocaleString()} 원`;
    totalPlElement.className = totalPL >= 0 ? 'profit' : 'loss';
    currentMonthPlElement.textContent = `${Math.round(currentMonthPL).toLocaleString()} 원`;
    currentMonthPlElement.className = currentMonthPL >= 0 ? 'profit' : 'loss';
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
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    let prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
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

function renderRecords(plMap = new Map(), soldBuyIds = new Set()) {
    recordListBody.innerHTML = '';
    const sortedRecords = [...records].reverse();
    sortedRecords.forEach(record => {
        const row = recordRowTemplate.content.cloneNode(true).querySelector('tr');
        if ((record.type === 'sell' && record.linked_buy_id) || (record.type === 'buy' && soldBuyIds.has(record.id.toString()))) {
            row.classList.add('record-completed');
        }
        const typeCell = row.querySelector('.record-type');
        if (record.type === 'buy') {
            typeCell.textContent = '매수';
            typeCell.style.color = '#3498db';
        } else {
            typeCell.textContent = '매도';
            typeCell.style.color = '#e74c3c';
        }
        row.querySelector('.record-trader').textContent = record.trader || '-';
        row.querySelector('.record-date').textContent = record.timestamp.substring(0, 10);
        row.querySelector('.record-currency').textContent = record.target_currency;
        row.querySelector('.record-foreign-amount').textContent = formatNumber(Number(record.foreign_amount).toFixed(2));
        row.querySelector('.record-rate').textContent = formatNumber(Number(record.exchange_rate).toFixed(2));
        row.querySelector('.record-base-amount').textContent = Math.round(record.base_amount).toLocaleString();
        const plCell = row.querySelector('.record-pl');
        if (record.type === 'sell' && plMap.has(record.id.toString())) {
            const profit = plMap.get(record.id.toString());
            plCell.textContent = Math.round(profit).toLocaleString();
            plCell.classList.add(profit >= 0 ? 'profit' : 'loss');
        }
        row.querySelector('.edit-btn').dataset.id = record.id;
        row.querySelector('.delete-btn').dataset.id = record.id;
        recordListBody.appendChild(row);
    });
}

function updateAvailableBuyOptions(soldBuyIds) {
    const selectedTrader = document.querySelector('input[name="trader"]:checked')?.value;
    let availableBuyRecords = [];
    if (selectedTrader) {
        availableBuyRecords = records.filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString()) && r.trader === selectedTrader);
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
        const analytics = calculateAnalytics(records);
        updateAvailableBuyOptions(analytics.soldBuyIds);
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
    const selectedTrader = document.querySelector('input[name="calc-trader"]:checked')?.value;
    const { soldBuyIds } = calculateAnalytics(records);
    let availableBuyRecords = [];
    if (selectedTrader) {
        availableBuyRecords = records.filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString()) && r.trader === selectedTrader);
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
    const buyRecord = records.find(r => r.id.toString() === buyRecordId);
    if (!buyRecord) return;

    calcResultsContainer.classList.remove('hidden');
    profitChartContainer.innerHTML = '';
    lossChartContainer.innerHTML = '';

    const baseRate = Number(buyRecord.exchange_rate) || 0;
    const foreignAmount = Number(buyRecord.foreign_amount) || 0;
    if (baseRate === 0 || foreignAmount === 0) return;

    const scenarios = [];
    for (let i = 1; i <= 5; i++) {
        scenarios.push(baseRate + i); // 수익 시나리오 (정수 기준)
        scenarios.push(baseRate - i); // 손실 시나리오 (정수 기준)
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

    chartData.forEach(data => {
        const row = document.createElement('div');
        row.className = 'h-bar-row';

        const label = document.createElement('span');
        label.className = 'h-bar-label';
        label.textContent = `${data.rate.toLocaleString()}원`;

        const barContainer = document.createElement('div');
        barContainer.className = 'h-bar-container';

        const barFill = document.createElement('div');
        barFill.className = 'h-bar-fill';

        const barWidth = maxAbsPL > 0 ? (Math.abs(data.pl) / maxAbsPL) * 100 : 0;
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

    // 수익은 오름차순, 손실은 내림차순으로 정렬하여 보기 좋게 만듦
    Array.from(profitChartContainer.children).sort((a,b) => a.querySelector('.h-bar-label').textContent.localeCompare(b.querySelector('.h-bar-label').textContent)).forEach(node => profitChartContainer.appendChild(node));
    Array.from(lossChartContainer.children).sort((a,b) => b.querySelector('.h-bar-label').textContent.localeCompare(a.querySelector('.h-bar-label').textContent)).forEach(node => lossChartContainer.appendChild(node));
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
document.querySelectorAll('input[name="trader"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (transactionTypeSelect.value === 'sell') {
            const analytics = calculateAnalytics(records);
            updateAvailableBuyOptions(analytics.soldBuyIds);
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
    const recordToHandle = records.find(r => r.id.toString() === recordId);
    if (!recordToHandle) return alert('수정할 기록을 찾지 못했습니다.');
    if (button.classList.contains('edit-btn')) {
        if (recordToHandle.type === 'sell') {
            alert("안정적인 데이터 관리를 위해 '판매' 기록은 수정할 수 없습니다.");
            return;
        }
        if (recordToHandle.remaining_amount && recordToHandle.remaining_amount != recordToHandle.foreign_amount) {
            alert("부분적으로 판매된 '구매' 기록은 수정할 수 없습니다.");
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
                records = records.filter(r => r.id.toString() !== result.id.toString());
                calculateAndRenderAll();
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
            if (action === 'create') {
                records.push(result.data);
            } else {
                const index = records.findIndex(r => r.id.toString() === result.data.id.toString());
                if (index > -1) records[index] = result.data;
            }
            calculateAndRenderAll();
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

// [추가] '판매 대상 매입 건' 선택 시, 해당 금액을 자동 입력하는 이벤트 리스너
linkedBuyIdSelect.addEventListener('change', function() {
    const selectedBuyId = this.value;

    // '-- 원본 구매 기록 선택 --'을 다시 선택한 경우, 입력창을 비웁니다.
    if (!selectedBuyId) {
        foreignAmountInput.value = '';
        baseAmountInput.value = '';
        return;
    }

    // 선택된 ID를 바탕으로 전체 기록에서 해당하는 '구매' 기록을 찾습니다.
    const selectedBuyRecord = records.find(r => r.id.toString() === selectedBuyId);

    if (selectedBuyRecord) {
        // 1. 해당 매수 건의 외화 금액을 가져와 포맷팅하여 입력창에 설정합니다.
        foreignAmountInput.value = formatNumber(selectedBuyRecord.foreign_amount);

        // 2. '원화 환산 금액' 자동 계산 함수를 수동으로 실행시켜줍니다.
        calculateBaseAmount();
    }
});

// ---------------------------------
// 6. 초기 실행
// ---------------------------------
document.addEventListener('DOMContentLoaded', () => {
    transactionDateInput.value = getTodayString();
    if (SCRIPT_URL.includes("여기에_본인의_웹_앱_URL을_붙여넣어주세요")) {
        alert("main.js 파일의 SCRIPT_URL 변수에 본인의 웹 앱 URL을 먼저 입력해주세요!");
        return;
    }
    loadingOverlay.classList.remove('hidden');
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            records = data;
            calculateAndRenderAll();
            handleTransactionTypeChange();
        })
        .catch(error => {
            console.error('데이터를 불러오는 중 에러 발생:', error);
            alert('데이터를 불러오는 데 실패했습니다. Apps Script 배포나 URL을 확인해주세요.');
        })
        .finally(() => {
            loadingOverlay.classList.add('hidden');
        });
});