using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using CurrencyManager.Models;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CurrencyManager.ViewModels
{
    public class MainViewModel : INotifyPropertyChanged
    {
        private SystemDefinition _selectedSystem;
        private IList<TierMappingItem> _selectedCurrencies;
        private int _selectedTier;

        public ObservableCollection<SystemDefinition> Systems { get; set; }
        public ObservableCollection<int> Tiers { get; set; }
        public ICommand AddSystemCommand { get; }
        public ICommand RemoveSystemCommand { get; }
        public ICommand IncreaseTierCommand { get; }
        public ICommand DecreaseTierCommand { get; }

        public SystemDefinition SelectedSystem
        {
            get => _selectedSystem;
            set
            {
                _selectedSystem = value;
                OnPropertyChanged();
                // Clear selection when system changes
                SelectedCurrencies = null;
            }
        }

        public IList<TierMappingItem> SelectedCurrencies
        {
            get => _selectedCurrencies;
            set
            {
                _selectedCurrencies = value;
                OnPropertyChanged();
            }
        }

        public int SelectedTier
        {
            get => _selectedTier;
            set
            {
                if (value >= 1 && value <= 4)
                {
                    _selectedTier = value;
                    OnPropertyChanged();
                    UpdateSelectedCurrenciesTier();
                }
            }
        }

        public MainViewModel()
        {
            Systems = new ObservableCollection<SystemDefinition>();
            Tiers = new ObservableCollection<int> { 1, 2, 3, 4 };
            _selectedTier = 1;
            InitializeSampleData();

            // Initialize commands
            IncreaseTierCommand = new RelayCommand(IncreaseTier, CanAdjustTier);
            DecreaseTierCommand = new RelayCommand(DecreaseTier, CanAdjustTier);
        }

        private bool CanAdjustTier(object parameter)
        {
            return SelectedCurrencies != null && SelectedCurrencies.Any();
        }

        private void IncreaseTier(object parameter)
        {
            if (SelectedCurrencies != null)
            {
                foreach (var currency in SelectedCurrencies)
                {
                    if (currency.Tier < 4)
                    {
                        currency.Tier++;
                    }
                }
            }
        }

        private void DecreaseTier(object parameter)
        {
            if (SelectedCurrencies != null)
            {
                foreach (var currency in SelectedCurrencies)
                {
                    if (currency.Tier > 1)
                    {
                        currency.Tier--;
                    }
                }
            }
        }

        private void UpdateSelectedCurrenciesTier()
        {
            if (SelectedCurrencies != null)
            {
                foreach (var currency in SelectedCurrencies)
                {
                    currency.Tier = SelectedTier;
                }
            }
        }

        private void InitializeSampleData()
        {
            // Initialize LBCM system with G8 currencies
            var lbcm = new SystemDefinition("LBCM");
            lbcm.CurrencyTierMap.Add(new TierMappingItem("USD", "US Dollar", 1));
            lbcm.CurrencyTierMap.Add(new TierMappingItem("EUR", "Euro", 1));
            lbcm.CurrencyTierMap.Add(new TierMappingItem("GBP", "British Pound", 1));
            lbcm.CurrencyTierMap.Add(new TierMappingItem("JPY", "Japanese Yen", 1));
            lbcm.CurrencyTierMap.Add(new TierMappingItem("CAD", "Canadian Dollar", 1));
            lbcm.CurrencyTierMap.Add(new TierMappingItem("AUD", "Australian Dollar", 1));
            lbcm.CurrencyTierMap.Add(new TierMappingItem("CHF", "Swiss Franc", 1));
            lbcm.CurrencyTierMap.Add(new TierMappingItem("NZD", "New Zealand Dollar", 1));
            Systems.Add(lbcm);

            // Initialize RFB system
            var rfb = new SystemDefinition("RFB");
            rfb.CurrencyTierMap.Add(new TierMappingItem("USD", "US Dollar", 1));
            rfb.CurrencyTierMap.Add(new TierMappingItem("GBP", "British Pound", 1));
            rfb.CurrencyTierMap.Add(new TierMappingItem("EUR", "Euro", 1));
            rfb.CurrencyTierMap.Add(new TierMappingItem("JPY", "Japanese Yen", 1));
            rfb.CurrencyTierMap.Add(new TierMappingItem("CAD", "Canadian Dollar", 1));
            rfb.CurrencyTierMap.Add(new TierMappingItem("AUD", "Australian Dollar", 1));
            rfb.CurrencyTierMap.Add(new TierMappingItem("CHF", "Swiss Franc", 1));
            rfb.CurrencyTierMap.Add(new TierMappingItem("NZD", "New Zealand Dollar", 1));
            Systems.Add(rfb);
        }

        public event PropertyChangedEventHandler PropertyChanged;

        protected virtual void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }

    public class RelayCommand : ICommand
    {
        private readonly Action<object> _execute;
        private readonly Predicate<object> _canExecute;

        public RelayCommand(Action<object> execute, Predicate<object> canExecute = null)
        {
            _execute = execute ?? throw new ArgumentNullException(nameof(execute));
            _canExecute = canExecute;
        }

        public bool CanExecute(object parameter)
        {
            return _canExecute == null || _canExecute(parameter);
        }

        public void Execute(object parameter)
        {
            _execute(parameter);
        }

        public event EventHandler CanExecuteChanged
        {
            add { CommandManager.RequerySuggested += value; }
            remove { CommandManager.RequerySuggested -= value; }
        }
    }
} 