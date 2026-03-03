/**
 * SignOS UI Component Builder (v1.3)
 * Agnostic generators for Swatches, Grids, Icons, and Shared Frontend Components
 */

window.SignOS_UI = {
    // Builds a dynamic color grid for Paint, Rowmark, or Vinyl
    buildColorGrid: function(config) {
        const grid = document.getElementById(config.containerId);
        if(!grid) return;
        grid.innerHTML = '';
        
        // Optional Custom Manual Entry Button
        if(config.showCustom) {
            const customBtn = document.createElement('button');
            customBtn.className = "w-8 h-8 rounded-full border-2 border-dashed border-gray-400 text-gray-500 hover:text-blue-600 hover:border-blue-500 flex items-center justify-center font-bold text-xs bg-gray-50 transition";
            customBtn.innerHTML = "+";
            customBtn.title = "Custom Manual Input";
            customBtn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                customBtn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onCustom) config.onCustom();
            };
            grid.appendChild(customBtn);
        }
        
        const fragment = document.createDocumentFragment();
        
        config.data.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `w-8 h-8 rounded border border-gray-300 shadow-sm hover:scale-110 transition focus:outline-none relative group overflow-hidden shrink-0 ${config.btnClass || ''}`;
            
            let bgStyle = '';
            let title = '';
            let searchData = '';
            
            if (config.type === 'rowmark') {
                let face = item.Cap_Hex || '#FFFFFF';
                let core = item.Core_Hex || '#000000';
                bgStyle = `linear-gradient(135deg, ${face} 50%, ${core} 50%)`;
                let thick = item.Thickness || '1/16"';
                let coreTxt = config.isReverse ? 'Clear' : (item.Core_Color || 'Unknown');
                title = `[${item.Item_Code}] ${item.Cap_Color} Face / ${coreTxt} Text (${thick})`;
                searchData = title.toLowerCase();
                btn.dataset.code = item.Item_Code; 
            } else if (config.type === 'paint' || config.type === 'vinyl') {
                bgStyle = item.Hex_Code || '#FFFFFF';
                let code = item.Code || item.Color_Code || '';
                let name = item.Name || item.Display_Name || '';
                title = `${name} (${code})`;
                searchData = title.toLowerCase();
                if(config.type === 'paint') btn.classList.add('rounded-full'); 
            }
            
            btn.style.background = bgStyle;
            btn.title = title;
            btn.dataset.search = searchData;
            
            btn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                btn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onSelect) config.onSelect(item);
            };
            fragment.appendChild(btn);
        });
        grid.appendChild(fragment);
    },

    // Builds a dynamic SVG icon grid from raw path data
    buildIconGrid: function(config) {
        const grid = document.getElementById(config.containerId);
        if (!grid) return;
        grid.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        
        (config.data || []).forEach(item => {
            const btn = document.createElement('button');
            btn.className = "w-12 h-12 rounded-lg border-2 border-gray-200 bg-white text-gray-700 shadow-sm hover:border-blue-500 flex items-center justify-center transition focus:outline-none flex-shrink-0 p-2";
            btn.title = item.Name;
            btn.dataset.code = item.Item_Code;
            
            // Reconstruct the SVG using the raw path and viewBox from the database
            const viewBox = item.ViewBox || "0 0 100 100";
            btn.innerHTML = `<svg viewBox="${viewBox}" class="w-full h-full" fill="currentColor"><path d="${item.SVG_Path}"/></svg>`;
            
            btn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                btn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onSelect) config.onSelect(item);
            };
            fragment.appendChild(btn);
        });
        grid.appendChild(fragment);
    },

    _clearActive: function(grid, ringClass) {
        Array.from(grid.children).forEach(b => b.classList.remove('ring-2', 'ring-offset-1', ringClass, 'border-transparent'));
    },

    // --- UTILITIES ---
    filterGrid: function(gridId, inputId) {
        const val = document.getElementById(inputId).value.toLowerCase();
        const grid = document.getElementById(gridId);
        if(!grid) return;
        Array.from(grid.children).forEach(btn => {
            if(btn.dataset.search) {
                btn.style.display = btn.dataset.search.includes(val) ? '' : 'none';
            }
        });
    },

    // --- GLOBAL LOADER OVERLAYS ---
    showLoader: function(containerId, message = "Connecting to Source Data...") {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Force container to relative so the absolute overlay stays inside it
        if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';
        
        let overlay = document.getElementById(containerId + '-loader');
        if(!overlay) {
            overlay = document.createElement('div');
            overlay.id = containerId + '-loader';
            overlay.className = "absolute inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl";
            container.appendChild(overlay);
        }
        
        overlay.innerHTML = `
            <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-2"></div>
            <span class="text-[9px] font-black text-blue-400 uppercase tracking-widest animate-pulse mt-3 text-center leading-relaxed">${message}</span>
        `;
        overlay.classList.remove('hidden');
    },

    hideLoader: function(containerId, isError = false, errorMsg = "⚠️ Connection Failed") {
        const overlay = document.getElementById(containerId + '-loader');
        if (!overlay) return;
        
        if (isError) {
            overlay.innerHTML = `<span class="text-[10px] font-black text-red-500 uppercase tracking-widest">${errorMsg}</span>`;
        } else {
            overlay.classList.add('hidden');
        }
    }
};

